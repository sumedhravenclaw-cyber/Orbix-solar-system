import {
  compose,
  sizeAgainstEarth,
  spokenGravity,
  spokenKm,
  spokenOrbit,
  spokenPeriod,
  spokenTemperature,
} from './phrasing';
import { resolveSubject, type GuideSubject } from './subject';
import type { GuideProvider, GuideReply, GuideRequest } from './types';

/**
 * The offline guide.
 *
 * This is not a stand-in for an AI call and it does not pretend to be one: it
 * is a grounded natural-language generator over the project's own data. Every
 * sentence it produces traces to a figure in `bodies.ts` / `moons.ts` or a
 * hand-written line in `celestialKnowledge.ts`, which is precisely why it
 * cannot hallucinate — there is no generative step that could invent a number.
 *
 * That makes it the right default rather than a fallback. It is instant, works
 * offline, costs nothing, and is scientifically safe. When a real model is
 * configured it takes over for phrasing and open-ended questions, but this
 * remains the floor the experience never drops below.
 */

/* ==========================================================================
   Introductions
   ========================================================================== */

/**
 * Several hooks already make a size comparison — Jupiter's opens on mass,
 * Mars's on width. Appending "It's a little over half the width of Earth" after
 * "Mars is roughly half the width of Earth" is the kind of seam that gives a
 * generated script away, so the size clause steps aside when the hook has
 * already covered it.
 */
const SIZE_TALK = /\b(width|wide|wider|size|larger|largest|biggest|smallest|massive|bigger|small)\b/i;

const wordCount = (text: string): number => text.trim().split(/\s+/).length;

/** Our own Moon, as the yardstick a listener already owns. */
const LUNAR_DIAMETER_KM = 3474;

/**
 * Facts computed from the catalogue rather than written by hand.
 *
 * Ten of the fifteen moons have no hand-written knowledge entry — they are real
 * bodies with real figures but no story worth a paragraph. Without this their
 * introduction is two sentences long. Everything here is derived from data
 * already in `moons.ts`, so it stays true without anyone maintaining it.
 */
const derivedFacts = (subject: GuideSubject): string[] => {
  const facts: string[] = [];

  if (subject.kind === 'moon') {
    const ratio = subject.diameterKm / LUNAR_DIAMETER_KM;
    facts.push(
      ratio > 1.05
        ? `It's about ${ratio.toFixed(1)} times the width of our own Moon.`
        : ratio > 0.85
          ? `It's close to the size of our own Moon.`
          : // Linear ratio, so say "narrower" — "fits inside N times" would
            // claim a volume comparison this number does not support.
            `It's roughly ${Math.max(2, Math.round(1 / ratio))} times narrower than our own Moon.`,
    );
    if (subject.axisKm) {
      facts.push(`It keeps an average distance of ${spokenKm(subject.axisKm)} from ${subject.parentName}.`);
    }
    if (subject.periodDays < 0) {
      facts.push(`It travels backwards around ${subject.parentName}, against the direction most moons go.`);
    }
    if (subject.inclination > 10) {
      facts.push(
        `Its orbit is tilted ${subject.inclination.toFixed(0)} degrees out of ${subject.parentName}'s equatorial plane, which is unusually steep.`,
      );
    }
    return facts;
  }

  if (subject.hasRings) facts.push(`It carries a ring system of its own.`);
  if (subject.satellites.length > 0) {
    facts.push(`The moons tracked here are ${subject.satellites.join(', ')}.`);
  }
  return facts;
};

/** Explorer aims at roughly 25 seconds of speech — about 60 words. */
const EXPLORER_TARGET_WORDS = 60;

const introduceExplorer = (subject: GuideSubject): string => {
  const { knowledge } = subject;
  const hook = knowledge?.hook ?? `You're looking at ${subject.name}. ${subject.blurb}`;

  const parts: string[] = [hook];

  if (!SIZE_TALK.test(hook)) {
    if (subject.earths !== undefined && subject.kind !== 'star') {
      parts.push(`It's ${sizeAgainstEarth(subject.earths)}.`);
    } else if (subject.kind === 'moon') {
      parts.push(`It's about ${spokenKm(subject.diameterKm)} across.`);
    }
  }

  if (subject.kind === 'planet' && subject.periodDays > 0) {
    parts.push(`A year here lasts ${spokenPeriod(subject.periodDays)}.`);
  } else if (subject.kind === 'moon') {
    parts.push(`It circles ${subject.parentName} once every ${spokenPeriod(subject.periodDays)}.`);
  }

  // Top up until the narration is worth listening to, skipping anything the
  // hook already said. Hand-written facts first; derived ones carry the bodies
  // that have no knowledge entry of their own.
  for (const fact of [...(knowledge?.facts ?? []), ...derivedFacts(subject)]) {
    if (wordCount(parts.join(' ')) >= EXPLORER_TARGET_WORDS) break;
    if (parts.some((part) => part.includes(fact))) continue;
    parts.push(fact);
  }

  return compose(...parts);
};

const introduceStudent = (subject: GuideSubject): string => {
  const { knowledge } = subject;

  const place =
    subject.kind === 'moon'
      ? `It orbits ${subject.parentName} at ${spokenKm(subject.axisKm ?? 0)}, completing a lap every ${spokenPeriod(subject.periodDays)}.`
      : subject.au
        ? `It sits ${spokenOrbit(subject.au)}, taking ${spokenPeriod(subject.periodDays)} to go round once.`
        : '';

  const spin =
    subject.rotationDays !== undefined && subject.rotationDays !== 0
      ? `It turns on its axis every ${spokenPeriod(subject.rotationDays)}${
          subject.rotationDays < 0 ? ', and it does so backwards' : ''
        }.`
      : '';

  const hook = knowledge?.hook ?? `This is ${subject.name}. ${subject.blurb}`;

  const physical = compose(
    subject.earths !== undefined && subject.kind !== 'star' && !SIZE_TALK.test(hook)
      ? `It's ${sizeAgainstEarth(subject.earths)}, ${spokenKm(subject.diameterKm)} across`
      : `It measures ${spokenKm(subject.diameterKm)} across`,
    knowledge?.gravity ? `with ${spokenGravity(knowledge.gravity)}` : '',
    knowledge?.meanTempC !== undefined
      ? `and temperatures ${spokenTemperature(knowledge.meanTempC)}`
      : '',
  );

  return compose(
    hook,
    knowledge?.mechanism,
    `${physical}.`,
    place,
    spin,
    knowledge?.air,
  );
};

const introduceExpert = (subject: GuideSubject): string => {
  const { knowledge } = subject;

  const elements =
    subject.kind === 'moon'
      ? compose(
          `Semi-major axis ${spokenKm(subject.axisKm ?? 0)} about ${subject.parentName},`,
          `inclination ${subject.inclination.toFixed(2)} degrees to its primary's equator,`,
          `sidereal period ${spokenPeriod(subject.periodDays)}${subject.periodDays < 0 ? ', retrograde' : ''}.`,
        )
      : compose(
          subject.au ? `Semi-major axis ${subject.au.toFixed(3)} astronomical units,` : '',
          subject.eccentricity !== undefined
            ? `eccentricity ${subject.eccentricity.toFixed(3)},`
            : '',
          `inclination ${subject.inclination.toFixed(2)} degrees to the ecliptic.`,
          subject.axialTilt !== undefined
            ? `Axial tilt ${subject.axialTilt.toFixed(2)} degrees.`
            : '',
        );

  const system = compose(
    subject.knownMoons && subject.knownMoons !== '—' && subject.knownMoons !== '0'
      ? `It has ${subject.knownMoons} confirmed moons${
          subject.satellites.length > 0
            ? `, of which this console tracks ${subject.satellites.length}: ${subject.satellites.join(', ')}`
            : ''
        }.`
      : '',
    subject.hasRings ? 'It carries a ring system.' : '',
  );

  return compose(
    knowledge?.hook ?? `${subject.name}. ${subject.blurb}`,
    knowledge?.mechanism,
    knowledge?.technical,
    elements,
    system,
  );
};

/* ==========================================================================
   Follow-up questions
   ========================================================================== */

/**
 * Intent routing.
 *
 * A keyword table rather than a classifier, and openly so: with a fixed subject
 * already selected, the space of sensible questions is small and the cost of a
 * wrong answer is high. Each intent resolves to material that is already known
 * to be true for this body, so an unrecognised question produces an honest
 * "here is what I do know" rather than an invented answer.
 */
interface Intent {
  readonly id: string;
  readonly test: RegExp;
  readonly resolve: (subject: GuideSubject) => string | undefined;
}

const INTENTS: readonly Intent[] = [
  {
    id: 'habitability',
    // Stems carry `\w*` so plurals and inflections match — a trailing `\b`
    // straight after a stem means "storm" misses "storms" and "land" misses
    // "landed", which silently drops the question into the fallback. The
    // leading `\b` stays, so "air" still does not match "airspeed".
    test: /\b(live|living|habitab\w*|surviv\w*|human\w*|people|colon\w*|settl\w*|breath\w*)\b/i,
    resolve: (s) => s.knowledge?.humans,
  },
  {
    id: 'temperature',
    test: /\b(hot|cold|temperature\w*|warm\w*|freez\w*|heat|degrees)\b/i,
    resolve: (s) =>
      s.knowledge?.meanTempC !== undefined
        ? compose(
            `${s.name} sits ${spokenTemperature(s.knowledge.meanTempC)} on average.`,
            s.knowledge.air,
          )
        : undefined,
  },
  {
    id: 'size',
    test: /\b(big|bigg\w*|size|larg\w*|small\w*|wide|width|diameter|compar\w*)\b/i,
    resolve: (s) =>
      compose(
        `${s.name} is ${spokenKm(s.diameterKm)} across`,
        s.earths !== undefined && s.kind !== 'star' ? `— ${sizeAgainstEarth(s.earths)}.` : '.',
      ),
  },
  {
    id: 'distance',
    test: /\b(far|distance|away|close|near\w*)\b/i,
    resolve: (s) =>
      s.kind === 'moon'
        ? `${s.name} orbits ${s.parentName} at an average of ${spokenKm(s.axisKm ?? 0)}.`
        : s.au
          ? `${s.name} orbits ${spokenOrbit(s.au)}, which is ${(s.au * 149.6).toFixed(0)} million kilometres.`
          : undefined,
  },
  {
    id: 'duration',
    test: /\b(years?|days?|long|period\w*|orbit\w*|rotat\w*|spin\w*)\b/i,
    resolve: (s) =>
      compose(
        s.kind === 'moon'
          ? `It completes an orbit of ${s.parentName} every ${spokenPeriod(s.periodDays)}.`
          : `A year on ${s.name} lasts ${spokenPeriod(s.periodDays)}.`,
        s.rotationDays !== undefined && s.rotationDays !== 0
          ? `It turns once every ${spokenPeriod(s.rotationDays)}${s.rotationDays < 0 ? ', backwards' : ''}.`
          : '',
      ),
  },
  {
    id: 'moons',
    test: /\b(moons?|satellites?|orbiting it)\b/i,
    resolve: (s) =>
      s.kind === 'moon'
        ? `${s.name} is itself a moon — it orbits ${s.parentName}.`
        : s.knownMoons && s.knownMoons !== '0' && s.knownMoons !== '—'
          ? compose(
              // The catalogue stores counts as strings, and Earth's is "1" —
              // "1 confirmed moons" is the sort of seam that reads as machine
              // output the moment it is spoken aloud.
              s.knownMoons === '1'
                ? `${s.name} has one moon.`
                : `${s.name} has ${s.knownMoons} confirmed moons.`,
              s.satellites.length > 0
                ? `The ${s.satellites.length === 1 ? 'one' : 'ones'} tracked here ${
                    s.satellites.length === 1 ? 'is' : 'are'
                  } ${s.satellites.join(', ')}.`
                : '',
            )
          : `${s.name} has no moons.`,
  },
  {
    id: 'rings',
    test: /\bring/i,
    resolve: (s) =>
      s.hasRings
        ? compose(`Yes — ${s.name} has a ring system.`, s.knowledge?.facts.find((f) => /ring/i.test(f)))
        : `${s.name} has no ring system of its own.`,
  },
  {
    // Ahead of `atmosphere`, because a question about storms should open on
    // the storm rather than on the gas mix it happens to occur in.
    id: 'weather',
    test: /\b(storm\w*|wind\w*|weather|hurricane\w*|cyclone\w*|spot)\b/i,
    resolve: (s) =>
      compose(
        s.knowledge?.facts.find((f) => /storm|wind|weather|spot|cyclone/i.test(f)),
        s.knowledge?.air,
      ),
  },
  {
    id: 'atmosphere',
    test: /\b(atmospher\w*|air|gas|gases|oxygen|cloud\w*)\b/i,
    resolve: (s) =>
      compose(
        s.knowledge?.air,
        s.knowledge?.facts.find((f) => /storm|wind|cloud|weather|atmospher/i.test(f)),
      ),
  },
  {
    id: 'gravity',
    test: /\b(gravity|weigh\w*|heavy|mass|fall\w*|jump\w*)\b/i,
    resolve: (s) =>
      s.knowledge?.gravity
        ? `${s.name} has ${spokenGravity(s.knowledge.gravity)}. If you weigh 70 kilograms here, you'd register about ${Math.round(
            70 * (s.knowledge.gravity / 9.81),
          )} there.`
        : undefined,
  },
  {
    id: 'life',
    test: /\b(life|alien\w*|organism\w*|bacteria|microb\w*)\b/i,
    resolve: (s) =>
      compose(
        s.knowledge?.facts.find((f) => /life|ocean|water|organic/i.test(f)),
        s.knowledge?.humans,
      ),
  },
  {
    id: 'visits',
    test: /\b(visit\w*|mission\w*|spacecraft|probe\w*|land\w*|explor\w*|rover\w*)\b/i,
    resolve: (s) =>
      s.knowledge?.facts.find((f) => /mission|probe|land|voyager|cassini|spacecraft|rover|discover/i.test(f)),
  },
  {
    id: 'why-name',
    test: /\b(name|called|why is it)\b/i,
    resolve: (s) => compose(`${s.name} — ${s.tagline}.`, s.knowledge?.hook),
  },
];

/**
 * Facts already used in this conversation, so a second question does not get
 * the same sentence back.
 */
const unusedFact = (subject: GuideSubject, history: readonly { text: string }[]): string | undefined =>
  subject.knowledge?.facts.find((fact) => !history.some((turn) => turn.text.includes(fact)));

const answerLocally = (subject: GuideSubject, question: string, history: readonly { text: string }[]): string => {
  for (const intent of INTENTS) {
    if (!intent.test.test(question)) continue;
    const resolved = intent.resolve(subject);
    if (resolved && resolved.trim().length > 0) return resolved;
  }

  // Nothing matched. Offer real material rather than inventing an answer.
  const spare = unusedFact(subject, history);
  return compose(
    `I don't have a reliable answer to that one about ${subject.name}, and I'd rather not guess.`,
    spare ? `Here's something I can vouch for though: ${spare}` : subject.blurb,
    'Try asking about its size, distance, temperature, atmosphere, moons, or whether humans could survive there.',
  );
};

/* ==========================================================================
   Provider
   ========================================================================== */

const INTRODUCE: Record<string, (subject: GuideSubject) => string> = {
  explorer: introduceExplorer,
  student: introduceStudent,
  expert: introduceExpert,
};

export const localGuide: GuideProvider = {
  id: 'local',

  introduce({ key, level }: GuideRequest): Promise<GuideReply> {
    const subject = resolveSubject(key);
    if (!subject) {
      return Promise.resolve({ text: 'I have no record of that object.', source: 'local' });
    }
    return Promise.resolve({ text: INTRODUCE[level](subject), source: 'local' });
  },

  answer({ key, question, history }): Promise<GuideReply> {
    const subject = resolveSubject(key);
    if (!subject) {
      return Promise.resolve({ text: 'I have no record of that object.', source: 'local' });
    }
    return Promise.resolve({ text: answerLocally(subject, question, history), source: 'local' });
  },
};
