import type { BodyKey } from './bodies';

/**
 * Narrative knowledge layer.
 *
 * This file deliberately holds ONLY what `bodies.ts` and `moons.ts` do not.
 * Every number already in those files — diameter, period, rotation, semi-major
 * axis, inclination, eccentricity, tilt, satellite counts — is read from them
 * at narration time. Duplicating it here would guarantee the two drift apart.
 *
 * What lives here is the material a guide needs and a physics table does not:
 * how a body feels underfoot, what its air is made of, why anyone cares, and
 * the handful of facts worth answering a follow-up question with.
 *
 * Sources are standard planetary fact-sheet values (NASA/JPL). Nothing here is
 * inferred or estimated — if a figure is not well established it is simply
 * absent, and the narrator omits that sentence rather than guessing.
 */

export interface BodyKnowledge {
  /** Short epithet used as the panel subtitle: "The Red Planet". */
  readonly tagline: string;
  /** Surface (or 1-bar level) gravity, m/s². Earth is 9.81. */
  readonly gravity?: number;
  /** Representative mean temperature, °C. */
  readonly meanTempC?: number;
  /** One plain sentence about the atmosphere, or its absence. */
  readonly air?: string;
  /** The opening hook, in a guide's voice. Beginner-friendly, no jargon. */
  readonly hook: string;
  /** One extra layer of "why", for the Student level. */
  readonly mechanism?: string;
  /** The technical detail an Expert listener is actually there for. */
  readonly technical?: string;
  /** Retrieval pool for follow-up questions. Each is self-contained. */
  readonly facts: readonly string[];
  /** Answer to "could humans live there?" — the most asked question. */
  readonly humans?: string;
}

export const KNOWLEDGE: Readonly<Partial<Record<BodyKey, BodyKnowledge>>> = {
  /* ======================================================================
     Star
     ====================================================================== */
  sun: {
    tagline: 'Our Star',
    gravity: 274,
    meanTempC: 5500,
    air: 'No surface at all — the visible edge is simply where the plasma turns transparent.',
    hook: 'This is the Sun, and everything else you can see here is falling around it.',
    mechanism:
      'It fuses about six hundred million tonnes of hydrogen into helium every second, and that outward pressure is the only thing holding it up against its own gravity.',
    technical:
      'A G2V main-sequence dwarf, roughly 4.6 billion years into a 10-billion-year hydrogen-burning lifetime. Energy released in the core takes tens of thousands of years to random-walk out to the photosphere.',
    facts: [
      'The Sun holds 99.86% of all the mass in the solar system.',
      'Its core runs at around 15 million degrees Celsius, while the visible surface is a comparatively cool 5,500.',
      'The corona — the faint outer atmosphere — is mysteriously hotter than the surface beneath it, at over a million degrees.',
      'Light from its surface takes about eight minutes and twenty seconds to reach Earth.',
      'It rotates faster at its equator than at its poles, because it is a ball of gas rather than a solid body.',
    ],
    humans:
      'Absolutely not. There is no surface to stand on, and nothing we have ever built could survive the heat. The closest any spacecraft has come is the Parker Solar Probe, which skims the outer corona behind a carbon-composite heat shield.',
  },

  /* ======================================================================
     Terrestrial planets
     ====================================================================== */
  mercury: {
    tagline: 'The Scorched World',
    gravity: 3.7,
    meanTempC: 167,
    air: 'Essentially no atmosphere — just a wisp of atoms knocked loose from the surface by sunlight.',
    hook: 'Mercury is the smallest planet and the closest to the Sun, and it is a world of extremes.',
    mechanism:
      'With almost no air to move heat around, the day side bakes past 420 degrees Celsius while the night side falls below minus 170. That is the largest temperature swing of any planet.',
    technical:
      'Locked in a 3:2 spin–orbit resonance: it turns exactly three times for every two orbits, so a single solar day lasts two Mercurian years. It also has a surprisingly large iron core, filling about 85% of its radius.',
    facts: [
      'Mercury has the largest temperature range of any planet — over 590 degrees between day and night.',
      'Despite being closest to the Sun, it is not the hottest planet. Venus is.',
      'Its year lasts only 88 Earth days, the shortest of any planet.',
      'There is water ice in permanently shadowed craters at its poles, which sunlight has never reached.',
      'Its surface looks much like our Moon — heavily cratered and geologically quiet.',
    ],
    humans:
      'No. There is no breathable air, no protection from radiation, and the temperature swing between day and night would defeat any practical shelter. The polar crater floors are the only places that stay stable, and even those are permanently frozen.',
  },

  venus: {
    tagline: "Earth's Hostile Twin",
    gravity: 8.87,
    meanTempC: 464,
    air: 'A crushing carbon-dioxide atmosphere, ninety times heavier than Earth’s, wrapped in sulphuric-acid cloud.',
    hook: 'Venus is almost exactly the same size as Earth, which makes what happened to it genuinely unsettling.',
    mechanism:
      'A runaway greenhouse effect trapped its heat until the surface reached 464 degrees Celsius — hot enough to melt lead, and hotter than Mercury even though Venus is twice as far from the Sun.',
    technical:
      'It rotates retrograde and extremely slowly, so its sidereal day of 243 Earth days is longer than its 225-day year. The upper atmosphere, by contrast, super-rotates around the planet in about four days.',
    facts: [
      'Venus is the hottest planet in the solar system at 464 degrees Celsius, despite Mercury being closer to the Sun.',
      'The surface pressure is about ninety times Earth’s — equivalent to being a kilometre underwater.',
      'It spins backwards compared to almost every other planet.',
      'Its clouds are made of sulphuric acid, and the rain never reaches the ground — it evaporates on the way down.',
      'Soviet Venera landers survived on the surface for at most two hours before being destroyed.',
    ],
    humans:
      'Not on the surface — the heat and pressure would destroy a lander within hours. Curiously, about fifty kilometres up, the pressure and temperature are close to Earth’s at sea level, which is why floating habitats in the Venusian cloud layer are a seriously discussed idea.',
  },

  earth: {
    tagline: 'The Blue Marble',
    gravity: 9.81,
    meanTempC: 15,
    air: 'Nitrogen and oxygen, at a pressure that lets liquid water sit stably on the surface.',
    hook: 'This is home — and so far, the only place in the universe where we know for certain that life exists.',
    mechanism:
      'Earth sits in the narrow band where water stays liquid, and it has a magnetic field generated by its molten iron core that deflects most of the solar wind. Both turn out to matter enormously.',
    technical:
      'Its 23.4-degree axial tilt drives the seasons, and that tilt is stabilised over long timescales by the Moon. Plate tectonics — unique among known worlds — continuously recycles carbon between the crust and atmosphere, acting as a long-term thermostat.',
    facts: [
      'Earth is the only body in the solar system with liquid water stable on its surface.',
      'About 71% of its surface is ocean, and most of that has never been directly explored.',
      'Its magnetic field deflects the solar wind, which is a large part of why the atmosphere is still here.',
      'The Moon is unusually large relative to its planet, and it stabilises Earth’s axial tilt.',
      'It is the densest planet in the solar system.',
    ],
    humans: 'You already do. This is the one that works.',
  },

  mars: {
    tagline: 'The Red Planet',
    gravity: 3.72,
    meanTempC: -63,
    air: 'A thin carbon-dioxide atmosphere, less than one percent of Earth’s pressure.',
    hook: 'Mars is roughly half the width of Earth, and it is rusty red because the iron in its soil has quite literally oxidised.',
    mechanism:
      'It was once warmer and wetter — the surface is carved with dry river valleys and lake beds. When its magnetic field shut down, the solar wind stripped most of the atmosphere away, and the water followed.',
    technical:
      'Home to Olympus Mons, a shield volcano about 22 kilometres high, and Valles Marineris, a canyon system over 4,000 kilometres long. Its 25.2-degree tilt is close to Earth’s, so it has comparable seasons over a year nearly twice as long.',
    facts: [
      'Mars has the tallest volcano in the solar system — Olympus Mons, roughly two and a half times the height of Everest.',
      'Its canyon system, Valles Marineris, would stretch across the entire United States.',
      'A Martian day is 24 hours and 37 minutes — remarkably close to Earth’s.',
      'Its two moons, Phobos and Deimos, are almost certainly captured asteroids.',
      'There is water ice at its poles and buried beneath much of its surface.',
      'Its surface gravity is about 38% of Earth’s, so you would weigh under half what you do here.',
      'It is the most explored world beyond Earth — NASA’s Curiosity and Perseverance rovers are both still working on the surface.',
    ],
    humans:
      'Not without serious help, but it is the most plausible candidate we have. The air is unbreathable and too thin to hold in heat, and there is no magnetic field to block radiation. Any real settlement would need to be pressurised and probably buried — but the water ice and the near-Earth day length genuinely help.',
  },

  /* ======================================================================
     Giants
     ====================================================================== */
  jupiter: {
    tagline: 'The Giant',
    gravity: 24.79,
    meanTempC: -108,
    air: 'Mostly hydrogen and helium — much the same recipe as the Sun.',
    hook: 'Jupiter is more massive than every other planet in the solar system combined, and it is not close.',
    mechanism:
      'It has no solid surface. Descending through the cloud tops, the hydrogen simply gets denser until it becomes a liquid, and deeper still it turns metallic and conducts electricity — which is what drives its enormous magnetic field.',
    technical:
      'It radiates roughly 1.6 times more energy than it receives from the Sun, still contracting and releasing gravitational heat. Its magnetosphere is the largest structure in the solar system after the Sun’s heliosphere.',
    facts: [
      'You could fit about 1,300 Earths inside Jupiter.',
      'The Great Red Spot is a storm wider than Earth that has been running for at least 190 years, and probably far longer.',
      'It rotates in under ten hours — the fastest of any planet — which visibly flattens it at the poles.',
      'Its magnetic field is around twenty thousand times stronger than Earth’s.',
      'It has 97 confirmed moons, four of which are large enough to be worlds in their own right.',
      'Its gravity shapes the asteroid belt and deflects many comets from the inner solar system.',
    ],
    humans:
      'Not on Jupiter itself — it is a gas giant with no solid surface to stand on, and the pressure and radiation below the cloud tops would crush and cook anything we sent. Its moons are the interesting target: Europa, in particular, has a liquid-water ocean under its ice.',
  },

  saturn: {
    tagline: 'The Ringed Jewel',
    gravity: 10.44,
    meanTempC: -139,
    air: 'Hydrogen and helium, banded into pale gold cloud layers.',
    hook: 'Saturn is the one everybody recognises, and its rings are far stranger than they look.',
    mechanism:
      'The rings are not solid. They are countless chunks of water ice, from grains of dust to house-sized boulders, each on its own orbit — which is why they show gaps and waves where moons tug at them.',
    technical:
      'Mean density is about 0.69 grams per cubic centimetre, less than water. The ring system spans roughly 280,000 kilometres yet is typically only about ten metres thick, giving it an aspect ratio unlike anything else in the solar system.',
    facts: [
      'Saturn is less dense than water — given a big enough ocean, it would float.',
      'Its rings span two-thirds of the Earth–Moon distance but are usually only about ten metres thick.',
      'The rings are made almost entirely of water ice, and may be less than a hundred million years old.',
      'It has a persistent hexagonal jet stream around its north pole, wide enough to swallow several Earths.',
      'Titan, its largest moon, has a thicker atmosphere than Earth does.',
      'It has 274 confirmed moons — more than any other planet.',
    ],
    humans:
      'Not on Saturn — there is no surface, and the interior pressure rises past anything survivable. Titan is the far more interesting prospect: it has a thick atmosphere and normal air pressure, though at minus 179 degrees you would need a heated suit rather than a pressure suit.',
  },

  uranus: {
    tagline: 'The Tilted World',
    gravity: 8.87,
    meanTempC: -195,
    air: 'Hydrogen, helium and methane — the methane is what makes it that pale cyan.',
    hook: 'Uranus orbits on its side, tipped almost a full ninety-eight degrees, so it rolls along its path rather than spinning upright.',
    mechanism:
      'That tilt is most likely the scar of an enormous ancient collision. It gives Uranus the most extreme seasons in the solar system — each pole spends 42 years in continuous sunlight, then 42 in darkness.',
    technical:
      'Classified an ice giant rather than a gas giant: beneath the hydrogen envelope lies a hot, dense fluid of water, ammonia and methane. Its magnetic field is offset from its centre and tilted about 59 degrees from its rotation axis.',
    facts: [
      'Uranus is tipped 98 degrees, so it effectively orbits on its side.',
      'It is the coldest planet in the solar system, reaching minus 224 degrees Celsius despite Neptune being further out.',
      'Each of its poles gets 42 years of continuous daylight followed by 42 years of night.',
      'It has a faint ring system, discovered in 1977.',
      'It was the first planet discovered with a telescope, by William Herschel in 1781.',
      'Only one spacecraft has ever visited — Voyager 2, in 1986.',
    ],
    humans:
      'No. There is no surface, temperatures sit near minus 200 degrees, and the atmosphere is hydrogen and methane. It is also so far out that sunlight there is about four hundred times weaker than at Earth.',
  },

  neptune: {
    tagline: 'The Wind World',
    gravity: 11.15,
    meanTempC: -201,
    air: 'Hydrogen, helium and methane, driven by the fastest winds anywhere in the solar system.',
    hook: 'Neptune is the outermost planet, and it has the most violent weather we know of.',
    mechanism:
      'Its winds reach around 2,000 kilometres per hour — supersonic — which is genuinely puzzling this far from the Sun, where there is very little incoming energy to drive them.',
    technical:
      'Like Uranus, an ice giant with a water-ammonia-methane mantle. It radiates about 2.6 times the energy it absorbs, implying a substantial internal heat source that Uranus appears to lack.',
    facts: [
      'Neptune has the fastest winds in the solar system, exceeding 2,000 kilometres per hour.',
      'It was found by mathematics before it was ever seen — predicted from irregularities in Uranus’s orbit.',
      'One Neptunian year is about 165 Earth years, so it has completed just one orbit since its discovery in 1846.',
      'Its largest moon, Triton, orbits backwards and is probably a captured Kuiper belt object.',
      'It radiates more than twice the heat it receives from the Sun.',
      'Sunlight there is roughly nine hundred times fainter than on Earth.',
    ],
    humans:
      'No. It is a freezing ice giant with no surface, supersonic winds, and an atmosphere of hydrogen and methane. At thirty times Earth’s distance from the Sun, it is also about four hours away at light speed.',
  },

  /* ======================================================================
     Moons — the ones with a story worth telling
     ====================================================================== */
  'earth:moon': {
    tagline: "Earth's Companion",
    gravity: 1.62,
    meanTempC: -20,
    air: 'No atmosphere to speak of.',
    hook: 'The Moon is the only world beyond Earth that humans have actually stood on.',
    mechanism:
      'It is tidally locked, so the same face is always turned toward us. It also raises Earth’s tides, and in doing so slowly steals rotational energy — which is why it drifts about 3.8 centimetres further away each year.',
    technical:
      'Most likely formed when a Mars-sized body struck the early Earth, throwing debris into orbit that re-accreted. Its stabilising influence on Earth’s axial tilt is probably significant for long-term climate.',
    facts: [
      'Twelve people have walked on the Moon, all between 1969 and 1972.',
      'It is moving away from Earth at about 3.8 centimetres per year.',
      'The same side always faces us, because its rotation and orbit are locked together.',
      'Its surface gravity is about one sixth of Earth’s.',
      'It very likely formed from debris after a Mars-sized impact on the early Earth.',
    ],
    humans:
      'Briefly, yes — and we have. Long-term is harder: there is no air, no magnetic shielding, and the two-week night is brutally cold. Water ice in the polar craters is the resource that would make a permanent base plausible.',
  },

  'jupiter:europa': {
    tagline: 'The Ocean Moon',
    hook: 'Europa is a ball of cracked ice — and underneath it, almost certainly, is an ocean.',
    mechanism:
      'Jupiter’s gravity flexes Europa as it orbits, and that constant kneading generates enough heat to keep liquid water beneath the shell.',
    technical:
      'The subsurface ocean is estimated to hold roughly twice the water of all Earth’s oceans combined, in contact with a rocky seafloor — a configuration that on Earth supports chemosynthetic life.',
    facts: [
      'Europa’s hidden ocean likely contains twice as much water as all of Earth’s oceans.',
      'Its ice shell is scarred with reddish cracks, probably salts pushed up from below.',
      'It is one of the smoothest bodies in the solar system — very few craters, so the surface is geologically young.',
      'NASA’s Europa Clipper mission is on its way to study it.',
    ],
    humans:
      'Not comfortably, but it is one of the best places to look for life that is not us. Jupiter’s radiation belts make the surface lethal, so any mission would have to get beneath the ice.',
  },

  'saturn:titan': {
    tagline: 'The Moon With Weather',
    gravity: 1.35,
    meanTempC: -179,
    air: 'A thick nitrogen atmosphere — denser at the surface than Earth’s.',
    hook: 'Titan is the only moon with a proper atmosphere, and the only other world with liquid on its surface.',
    mechanism:
      'At minus 179 degrees, water is rock-hard, but methane behaves the way water does here — it rains, pools into lakes, carves channels, and evaporates back into clouds.',
    technical:
      'Surface pressure is about 1.45 bar, roughly 45% higher than Earth’s at sea level. Huygens landed there in 2005, the most distant landing ever made.',
    facts: [
      'Titan has lakes and rivers of liquid methane and ethane.',
      'Its atmosphere is thicker at the surface than Earth’s.',
      'It is bigger than the planet Mercury.',
      'The Huygens probe landed there in 2005 — the most distant landing humans have achieved.',
      'Its thick orange haze hid the surface from view until radar and infrared saw through it.',
    ],
    humans:
      'You would not need a pressure suit — the air pressure is close to Earth’s — but you would need heating and oxygen. The low gravity and thick air mean a person with strapped-on wings could genuinely fly.',
  },

  'jupiter:io': {
    tagline: 'The Volcanic Moon',
    hook: 'Io is the most volcanically violent place in the solar system — hundreds of active volcanoes, erupting constantly.',
    mechanism:
      'It is caught in a gravitational tug of war between Jupiter and the other large moons, and the flexing heats its interior enough to keep it permanently molten.',
    facts: [
      'Io has over 400 active volcanoes, some throwing plumes 300 kilometres high.',
      'Its surface is repaved so often that it has almost no impact craters.',
      'Sulphur compounds give it a yellow, orange and white colouring often compared to a pizza.',
    ],
    humans:
      'No. Between the constant eruptions and Jupiter’s radiation belts, it is one of the most hostile surfaces we know of.',
  },

  'saturn:enceladus': {
    tagline: 'The Geyser Moon',
    hook: 'Enceladus is small, bright, and shoots plumes of water into space from cracks near its south pole.',
    mechanism:
      'Those geysers come from a subsurface ocean, and Cassini flew straight through them — finding water, salts and organic molecules.',
    facts: [
      'Its south-polar geysers feed material directly into Saturn’s E ring.',
      'Cassini flew through the plumes and detected salts and organic compounds.',
      'It reflects almost all the sunlight that hits it, making it one of the brightest objects in the solar system.',
    ],
    humans:
      'Not somewhere to live, but a serious candidate in the search for life — its plumes let a spacecraft sample an alien ocean without ever landing.',
  },

  'jupiter:ganymede': {
    tagline: 'The Largest Moon',
    hook: 'Ganymede is the biggest moon in the solar system — larger than the planet Mercury.',
    mechanism:
      'It is the only moon known to generate its own magnetic field, which suggests a liquid iron core still churning inside it.',
    facts: [
      'Ganymede is larger than Mercury, though far less massive.',
      'It is the only moon with its own magnetic field.',
      'It probably has a salt-water ocean buried deep beneath its ice.',
    ],
  },

  'neptune:triton': {
    tagline: 'The Captured World',
    hook: 'Triton orbits Neptune backwards, which is the clearest sign that it did not form there.',
    mechanism:
      'It was almost certainly captured from the Kuiper belt. That retrograde orbit is slowly decaying, and in a few billion years Neptune’s tides will tear it apart into a ring.',
    facts: [
      'Triton is the only large moon in the solar system with a retrograde orbit.',
      'It has active nitrogen geysers despite a surface temperature near minus 235 degrees.',
      'It is slowly spiralling inward and will eventually be torn into a ring system.',
    ],
  },
};

/** Look up narrative knowledge for a body, if any exists. */
export const knowledgeFor = (key: BodyKey): BodyKnowledge | undefined => KNOWLEDGE[key];
