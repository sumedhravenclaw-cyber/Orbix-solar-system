import type { GuideSubject } from './subject';
import type { GuideLevel } from './types';

/**
 * System prompt for a configured language model.
 *
 * The single most important job here is preventing invention. The model is
 * given the body's real figures as context and told that anything outside that
 * context is off limits — because a guide that confidently states a wrong
 * orbital period is worse than no guide at all.
 */

const LEVEL_BRIEF: Record<GuideLevel, string> = {
  explorer:
    'Your listener is a curious beginner. No jargon. Use everyday comparisons. Two or three short sentences.',
  student:
    'Your listener knows some science. Explain the mechanism behind the fact, not just the fact. Include the key figures. Four or five sentences.',
  expert:
    'Your listener is comfortable with astronomy. Use orbital elements and physical parameters precisely, and name the phenomena involved. Five or six sentences.',
};

export const buildSystemPrompt = (level: GuideLevel): string =>
  [
    'You are the ORBIX SOL space guide, narrating an interactive 3D solar system for someone who has just selected a body on screen.',
    '',
    'Voice: a knowledgeable human astronomer speaking aloud — warm, precise, unhurried. Never an encyclopaedia entry.',
    'Your words will be spoken by a speech synthesiser, so: natural sentence lengths, no bullet points, no markdown, no parenthetical asides, and no long strings of digits. Round numbers to what a listener can hold in their head.',
    '',
    LEVEL_BRIEF[level],
    '',
    'Rules you must not break:',
    '- Use only the facts supplied in the context block. If you do not have a fact, say so plainly rather than guessing.',
    '- Never state a hypothesis as established. Say "probably" or "we think" where that is the honest word.',
    '- Use metric units.',
    '- Explain any technical term the moment you use it.',
    '- Keep the initial introduction to roughly 20 to 60 seconds of speech; follow-up answers 10 to 40 seconds.',
    '- Do not greet the user or introduce yourself. Begin with the subject.',
  ].join('\n');

/** The grounding block: everything true about this body, and nothing else. */
export const buildContext = (subject: GuideSubject): string => {
  const lines: string[] = [
    `Name: ${subject.name}`,
    `Classification: ${subject.classification}`,
    `Epithet: ${subject.tagline}`,
    `Diameter: ${subject.diameterKm.toLocaleString('en-GB')} km`,
  ];

  if (subject.earths !== undefined) lines.push(`Radius relative to Earth: ${subject.earths}`);
  if (subject.au) lines.push(`Semi-major axis from the Sun: ${subject.au} AU`);
  if (subject.axisKm) lines.push(`Semi-major axis about ${subject.parentName}: ${subject.axisKm} km`);
  lines.push(`Orbital period: ${subject.periodDays.toFixed(2)} Earth days`);
  if (subject.rotationDays !== undefined) {
    lines.push(
      `Rotation period: ${subject.rotationDays} Earth days${subject.rotationDays < 0 ? ' (retrograde)' : ''}`,
    );
  }
  if (subject.eccentricity !== undefined) lines.push(`Eccentricity: ${subject.eccentricity}`);
  lines.push(`Inclination: ${subject.inclination} degrees`);
  if (subject.axialTilt !== undefined) lines.push(`Axial tilt: ${subject.axialTilt} degrees`);
  if (subject.knownMoons) lines.push(`Confirmed moons: ${subject.knownMoons}`);
  if (subject.satellites.length) lines.push(`Tracked satellites: ${subject.satellites.join(', ')}`);
  if (subject.hasRings) lines.push('Has a ring system: yes');

  const k = subject.knowledge;
  if (k) {
    if (k.gravity) lines.push(`Surface gravity: ${k.gravity} m/s²`);
    if (k.meanTempC !== undefined) lines.push(`Mean temperature: ${k.meanTempC} °C`);
    if (k.air) lines.push(`Atmosphere: ${k.air}`);
    if (k.mechanism) lines.push(`Key mechanism: ${k.mechanism}`);
    if (k.technical) lines.push(`Technical detail: ${k.technical}`);
    if (k.humans) lines.push(`Human survivability: ${k.humans}`);
    lines.push(...k.facts.map((fact) => `Fact: ${fact}`));
  }
  lines.push(`Catalogue note: ${subject.blurb}`);

  return `CONTEXT — everything established about this body:\n${lines.join('\n')}`;
};
