# ORBIX SOL

A heliocentric propagation console — React 19 + Vite + TypeScript + Three.js r185.

Nine bodies and fifteen natural satellites on compressed-scale orbits with
physically faithful *relative* periods, procedurally painted surfaces,
atmospheric limb scattering, an instanced asteroid belt, and a mission-control
HUD modelled on the [ORBIX](https://github.com/sumedhravenclaw-cyber/Orbix)
orbital-tracking console.

Ships **zero image assets**. Every surface, cloud deck, ring system, city-light
map and corona is painted into a `<canvas>` at runtime from a value-noise field.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint
npm run typecheck
```

---

## Architecture

The central decision: **React never drives a frame.**

```
user input ──▶ reducer ──▶ effect ──▶ engine method     React configures the engine
engine ──▶ telemetry store ──▶ useSyncExternalStore     engine feeds the readouts
```

Positions, angles and elapsed time live inside `SolarSystemEngine`. Routing them
through React state would re-render the tree sixty times a second to move a few
dozen text nodes.

```
src/
├─ data/
│   ├─ bodies.ts              planets — pure data, zero Three.js
│   └─ moons.ts               fifteen satellites, indexed by parent
├─ engine/                    imperative 3D layer
│   ├─ SolarSystemEngine.ts   orchestrator: renderer, loop, LOD, telemetry, teardown
│   ├─ CameraDirector.ts      focus flight + lock-on (planets and moons alike)
│   ├─ Picker.ts              raycasting, drag-vs-click, hover coalescing
│   ├─ createSun.ts           shader photosphere with limb darkening
│   ├─ createPlanet.ts        surface, tilt, rings, atmosphere, clouds, satellites
│   ├─ createMoons.ts         satellite systems on three shared materials
│   ├─ createAsteroidBelt.ts  2,400 instanced rocks in three Keplerian shells
│   ├─ atmosphere.ts          Fresnel + terminator limb shell
│   ├─ earthDetail.ts         cloud deck and night-side city lights
│   ├─ createStarfield.ts     9k points, per-vertex twinkle shader
│   ├─ textures.ts            procedural surface / ring / glow painters
│   ├─ noise.ts               hash → value noise → fBm (pure)
│   ├─ scale.ts               the compression model (pure)
│   └─ disposal.ts            GPU resource registry
├─ state/
│   ├─ simulation.ts          reducer, speed steps, layer labels (pure)
│   ├─ contexts.ts            context objects + accessor hooks
│   └─ SimulationContext.tsx  provider: owns the engine, syncs both directions
├─ components/
│   ├─ hud/                   Primitives, IdentityBlock, SystemMap, LayerPanel,
│   │                         TargetReadout, CataloguePanel, TimeController,
│   │                         BootScreen, ConsoleLayout
│   ├─ mobile/MobileSheet.tsx tabbed bottom sheet under 68rem
│   └─ icons/Icons.tsx        one inline-SVG icon family
└─ styles/                    tokens.css + the global `.hud-*` vocabulary
```

### Why two contexts

`SimulationActionsContext` holds only stable `useCallback`s, so its identity
never changes after mount. Every button in the console subscribes to actions
alone and never re-renders when unrelated state moves.

### Why the engine owns its canvas

Disposing a `WebGLRenderer` force-loses its GL context, and a force-lost canvas
can never serve a working one again. If React owned the canvas, the *second*
mount would get a dead one — which is exactly what StrictMode does on every dev
reload. React renders an empty container; the engine creates and destroys the
canvas inside it.

### Why telemetry is an external store

`useSyncExternalStore` guarantees React never renders a torn value from a
mutable external source. The engine publishes a new frozen snapshot **only when
a displayed value changes**, so identity comparison does the throttling.

---

## Satellites

Fifteen moons, chosen because rendering all 400-odd known satellites would be
dishonest at this scale — most are sub-kilometre captured rock.

| Primary | Satellites |
| --- | --- |
| Earth | Moon |
| Mars | Phobos, Deimos |
| Jupiter | Io, Europa, Ganymede, Callisto |
| Saturn | Enceladus, Rhea, Titan, Iapetus |
| Uranus | Ariel, Titania, Oberon |
| Neptune | Triton (retrograde, 157° inclination) |

Each hangs off its planet's anchor, so it inherits the planet's heliocentric
motion for free and only solves its own local circle. All are tidally locked,
which is true of every moon in the list.

**Their own compression curve.** The real ratios are brutal: the Moon is 0.27 of
Earth, but Phobos is 0.0033 of Mars — faithfully rendered it would be a third of
a pixel. Radius and orbit are both compressed against the *parent*, and orbits
are clamped so no moon system strays outside its planet's visual envelope. Every
orbit is verified to clear its planet and, for Saturn and Uranus, their rings.

**Level of detail.** A moon system only draws when its parent is the focus, is
hovered, or the camera has come within ~46 planetary radii. At system overview
every moon would be sub-pixel clutter drawn over its own parent, plus fifteen
extra orbit traces crossing the ecliptic. Hidden subtrees also raycast to
nothing, so the LOD rule doubles as pick filtering. The Layers panel reports how
many satellites are currently resolved, so the rule explains itself.

---

## What makes it read as real

| Feature | Why it matters |
| --- | --- |
| **Atmospheric limb** | A Fresnel shell weighted by *both* view angle and sun angle. Weighting by view angle alone makes the night side glow — the tell-tale fake atmosphere. |
| **Earth cloud deck** | A separate sphere at its own rotation rate, so weather drifts over the ground and casts a silhouette against the limb. |
| **Night-side city lights** | `emissiveMap` glows through daylight, which looks like a bug. `onBeforeCompile` multiplies the emissive term by how far the fragment faces away from the Sun — keeping shadows, tone mapping and fog intact, which a bespoke ShaderMaterial would throw away. |
| **Sun photosphere** | Granulation sampled twice at diverging rates so cells churn, plus limb darkening, plus output above 1.0 to feed the bloom pass. |
| **Asteroid belt** | 2,400 instanced rocks in three shells rotating at their own Keplerian rates, with the Kirkwood 3:1 resonance gap swept clear. A uniform ring would be the *less* realistic choice. |
| **Orbit fidelity** | Real eccentricity and inclination; the Sun sits at a focus; the trace is sampled from the same parametric ellipse the planet follows, so a planet can never drift off its own track. |

### The physics, and what is faked

| Quantity | Treatment |
| --- | --- |
| Orbital **period ratios** | Exact. ω = 2π / period, uncompressed. |
| Orbit shape | Real eccentricity and inclination. |
| Axial tilt | Real, including Uranus at 97.8° and Venus retrograde. |
| **Distance** | Compressed: `15 + 36·log₁₀(1 + AU)` — 77× span becomes ~3.3×. |
| **Radius** | Compressed: `1.02 · earths^0.4` — 29× span becomes ~3.8×. |
| **Spin rate** | Own clock. True 1:365 would strobe; relative rates are kept. |
| Light falloff | `decay = 0`. Real inverse-square over 77× leaves Neptune black. |

---

## The console

The HUD is built from one primitive set — `Panel`, `PanelHeading`, `Readout`,
`StatusDot`, `Toggle` — so the bezel, label and readout language is identical
everywhere, exactly as in the reference console.

| Surface | Role |
| --- | --- |
| **Identity block** | Wordmark, propagation state, live frame rate |
| **Plan view** | Overhead ecliptic map — the fixed answer to "where is everything", and the only way to see Neptune while zoomed in on Earth |
| **Layers** | Orbits, labels, satellites, atmospheres, belt |
| **Target readout** | Acquired body, six instrument cells, camera range, satellite list |
| **Catalogue** | All 24 bodies, filterable, moons indented under their primary |
| **Time controller** | Hold/run, mission clock, rate slider 0.1× – 60× |
| **Boot screen** | Determinate progress with a stage log |

### Design system

Tokens are ported from the reference console's `index.css`, so the two products
read as one system: **amber** is the instrument colour, **cyan** means "this is
what you selected", green nominal, red alert, violet satellites. Type is IBM
Plex Sans for prose and JetBrains Mono for every readout, self-hosted via
`@fontsource` (latin subsets only, no runtime font-CDN request).

The `ui-ux-pro-max` design-system query returned a light-mode landing palette
for this brief, which is wrong for a dark cinematic 3D product — so the palette
comes from the reference repo and the skill was used for structure, motion and
accessibility rules instead.

### Animation inventory

| Surface | Motion |
| --- | --- |
| Rails | Staggered slot entrance, 40ms apart, directional per side |
| Target readout | Spring scale + slide on enter; faster ease-in on exit |
| Readout cells | 25ms cascade, restarted per target |
| Satellite list | 40ms cascade |
| Catalogue rows | 18ms cascade on filter |
| Plan view | Pinging halo on the selected body |
| Layer switch | Knob translates as well as recolouring |
| Boot screen | Self-tracing orbit ring, determinate bar via `scaleX` |
| Buttons | `scale(0.97)` press, bounded so nothing reflows |
| Planets (3D) | Eased hover emphasis, billboarded reticle, faded satellite reveal |
| Sun (3D) | Churning granulation, breathing corona |
| Stars (3D) | Per-vertex twinkle from two detuned sines |

Everything animates `transform` and `opacity` only — no layout thrash, no CLS.

---

## Accessibility

- Every body — including all fifteen moons — is a real focusable button in the
  catalogue. Clicking a sphere in a WebGL canvas is inaccessible by
  construction, so the canvas is `aria-hidden` and the catalogue is the
  equivalent path.
- The plan view is `role="img"` with a described summary, backed by an operable
  legend list — a map that only works with a mouse is not a control.
- Skip link to the transport controls as the first tab stop.
- `prefers-reduced-motion` honoured live, not read once: CSS durations collapse,
  the camera jumps instead of flying, the corona stops breathing, granulation
  freezes, and the star twinkle uniform goes to zero.
- Touch targets ≥ 44px, tightened to 30px only where `pointer: fine`.
- Contrast: ink 14.9:1, dim 8.0:1, mute 4.9:1 on the console background.
- Layer switches move a knob as well as changing colour; moons are indented and
  prefixed, so hierarchy never depends on colour perception.
- The rate slider reports `aria-valuetext` as "2× speed", not a raw index.
- Mission clock is `aria-live="off"`; a counter announcing itself eight times a
  second makes a screen reader unusable. Target acquisition announces once, as a
  whole sentence.
- `Escape` works from inside the search field (blurs) and everywhere else
  (releases the target, then resets the view).

---

## Performance

- `renderer.setAnimationLoop` drives the loop and is set to `null` on
  `visibilitychange` — a hidden tab renders nothing.
- One shared `MeshBasicMaterial` backs all 24 hit spheres; three shared
  materials cover all fifteen moons.
- The asteroid belt is three draw calls, not 2,400. Per-instance orbits would
  mean recomposing 2,400 matrices per frame; instead each shell is rigid and
  rotates at the mean rate for its radius, so inner shells still lap outer ones.
- Satellite LOD keeps ~19 subtrees and their orbit traces out of the frustum at
  overview.
- Every geometry, material and texture is registered in a `DisposalRegistry` and
  released in one pass.
- Hover raycasts are coalesced to one per animation frame.
- Catalogue filtering runs through `useDeferredValue`, so typing stays
  responsive while a 24-row list re-filters.
- Building the procedural surfaces costs ~1s of main-thread work. The build
  yields between stages (`scheduler.yield()` where available), so the boot
  screen animates and reports real progress instead of freezing.

  | chunk | raw | gzip |
  | --- | --- | --- |
  | three | 573 kB | 143 kB |
  | react | 192 kB | 60 kB |
  | app | 64 kB | 24 kB |

---

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit the camera |
| Scroll / pinch | Zoom |
| Right-drag | Pan |
| Click a body | Fly to it and lock on — works on moons too |
| `Space` | Hold / resume propagation |
| `Esc` | Release the target, then reset the view |
| `←` `→` | Step the rate multiplier |
| `/` | Jump to the catalogue filter |

Focus is **lock-on**, not a fixed vantage point: once the flight lands, the
camera is translated by the body's own displacement each frame, so you keep full
orbit and zoom freedom around a moving target.
#   O r b i x - s o l a r - s y s t e m  
 