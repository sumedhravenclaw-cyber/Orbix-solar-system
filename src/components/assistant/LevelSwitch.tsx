import { memo } from 'react';

import { GUIDE_LEVELS, LEVEL_HINT, LEVEL_LABEL, type GuideLevel } from '../../services/ai/types';
import styles from './SpaceAssistant.module.css';

/**
 * Explanation depth.
 *
 * A three-way toggle rather than a select: the options are few, mutually
 * exclusive, and worth seeing all at once. `aria-pressed` carries the state and
 * the label text changes weight as well as colour, so the active level survives
 * both a screen reader and a colour-blind reading.
 */
export const LevelSwitch = memo(function LevelSwitch({
  level,
  onChange,
}: {
  level: GuideLevel;
  onChange: (level: GuideLevel) => void;
}) {
  return (
    <div className={styles.levels} role="group" aria-label="Explanation level">
      {GUIDE_LEVELS.map((option) => (
        <button
          key={option}
          type="button"
          className={styles.level}
          aria-pressed={option === level}
          title={LEVEL_HINT[option]}
          onClick={() => onChange(option)}
        >
          {LEVEL_LABEL[option]}
        </button>
      ))}
    </div>
  );
});
