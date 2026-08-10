/**
 * Turning figures into something worth listening to.
 *
 * Speech synthesis reads "12756" as twelve thousand seven hundred and fifty
 * six, which is accurate and completely unmemorable. A guide says "about
 * twelve and a half thousand kilometres" and moves on. Every helper here trades
 * a little precision for a sentence that survives being heard once — the exact
 * figures are already on screen in the target readout beside the panel.
 */

/**
 * Distances, rounded to the precision a listener can actually hold.
 *
 * The rounding step has to scale with the magnitude. A flat round-to-the-
 * nearest-hundred reads well for a planet and turns Phobos, which is 22 km
 * across, into "0 kilometres".
 */
export const spokenKm = (km: number): string => {
  if (km >= 1_000_000) return `${(km / 1_000_000).toFixed(1)} million kilometres`;
  if (km >= 10_000) return `${Math.round(km / 1000).toLocaleString('en-GB')} thousand kilometres`;

  const step = km >= 1000 ? 100 : km >= 100 ? 10 : 1;
  return `${(Math.round(km / step) * step).toLocaleString('en-GB')} kilometres`;
};

/** Size against Earth, phrased the way a person would say it. */
export const sizeAgainstEarth = (earths: number): string => {
  if (earths >= 50) return `over a hundred times the width of Earth`;
  if (earths >= 2) return `about ${earths.toFixed(1).replace(/\.0$/, '')} times wider than Earth`;
  if (earths >= 0.9 && earths <= 1.1) return 'almost exactly the size of Earth';
  if (earths >= 0.45) return `a little over half the width of Earth`;
  if (earths >= 0.3) return `roughly a third of Earth's width`;
  return `a small fraction of Earth's width`;
};

/** Orbital or rotational period, in whichever unit stays imaginable. */
export const spokenPeriod = (days: number): string => {
  const magnitude = Math.abs(days);
  if (magnitude < 2) return `${(magnitude * 24).toFixed(1)} hours`;
  if (magnitude < 700) return `${magnitude.toFixed(magnitude < 20 ? 1 : 0)} Earth days`;
  return `${(magnitude / 365.25).toFixed(magnitude / 365.25 < 20 ? 1 : 0)} Earth years`;
};

/** Surface gravity, expressed as the thing people care about: their weight. */
export const spokenGravity = (metresPerSecondSquared: number): string => {
  const ratio = metresPerSecondSquared / 9.81;
  if (ratio >= 10) return `gravity around ${Math.round(ratio)} times Earth's`;
  if (ratio >= 1.15) return `gravity about ${ratio.toFixed(1)} times Earth's`;
  if (ratio >= 0.9) return `gravity close to Earth's`;
  return `gravity about ${Math.round(ratio * 100)}% of Earth's`;
};

export const spokenTemperature = (celsius: number): string =>
  celsius < 0
    ? `around minus ${Math.abs(Math.round(celsius))} degrees Celsius`
    : `around ${Math.round(celsius)} degrees Celsius`;

/** Distance from the Sun, anchored to Earth's orbit rather than raw AU. */
export const spokenOrbit = (au: number): string => {
  if (au === 0) return '';
  if (au >= 0.95 && au <= 1.05) return "at Earth's distance from the Sun";
  if (au < 1) return `about ${Math.round(au * 100)}% of Earth's distance from the Sun`;
  return `about ${au.toFixed(au < 10 ? 1 : 0)} times further from the Sun than Earth`;
};

/** Join sentence fragments, dropping any that turned out empty. */
export const compose = (...parts: (string | false | null | undefined)[]): string =>
  parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim())
    .join(' ');

/**
 * Rough spoken duration, used to keep introductions inside their brief.
 * Conversational synthesis lands near 150 words per minute.
 */
export const estimateSpokenSeconds = (text: string): number =>
  Math.round((text.trim().split(/\s+/).length / 150) * 60);
