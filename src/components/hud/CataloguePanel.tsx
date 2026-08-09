import { memo, useDeferredValue, useId, useMemo } from 'react';

import { BODIES, type BodyKey } from '../../data/bodies';
import { MOONS } from '../../data/moons';
import { useSimulationActions, useSimulationState } from '../../state/contexts';
import { SearchIcon } from '../icons/Icons';
import { Panel, PanelHeading } from './Primitives';
import styles from './CataloguePanel.module.css';

/**
 * Searchable catalogue of every tracked body — the console's equivalent of the
 * satellite catalogue in ORBIX.
 *
 * This is also the keyboard and screen-reader route to the scene. Clicking a
 * sphere inside a WebGL canvas is inaccessible by construction, so every body
 * is a real focusable button here.
 */

interface Entry {
  readonly key: BodyKey;
  readonly name: string;
  readonly kind: string;
  readonly swatch: string;
  readonly parent: string | null;
  /** Pre-lowercased haystack, built once. */
  readonly search: string;
}

/** Built once at module load — the catalogue never changes at runtime. */
const CATALOGUE: readonly Entry[] = [
  ...BODIES.map((body) => ({
    key: body.key as BodyKey,
    name: body.name,
    kind: body.key === 'sun' ? 'Star' : body.type.split(' ')[0],
    swatch: body.swatch,
    parent: null,
    search: `${body.name} ${body.type}`.toLowerCase(),
  })),
  ...MOONS.map((moon) => ({
    key: moon.key as BodyKey,
    name: moon.name,
    kind: 'Moon',
    swatch: moon.swatch,
    parent: moon.parent,
    search: `${moon.name} ${moon.parent} moon satellite`.toLowerCase(),
  })),
];

export const CataloguePanel = memo(function CataloguePanel() {
  const { query, selectedKey, phase } = useSimulationState();
  const { setQuery, select } = useSimulationActions();
  const inputId = useId();

  // Typing stays responsive even though filtering re-renders a 24-row list:
  // the input updates immediately, the list catches up.
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return CATALOGUE;
    return CATALOGUE.filter((entry) => entry.search.includes(needle));
  }, [deferredQuery]);

  if (phase !== 'ready') return null;

  return (
    <Panel label="Body catalogue" className={styles.panel}>
      <PanelHeading>
        Catalogue · {results.length}/{CATALOGUE.length}
      </PanelHeading>

      <div className={styles.searchRow}>
        <span className={styles.searchIcon} aria-hidden="true">
          <SearchIcon size={13} />
        </span>
        {/* A visible label would cost a row in a dense console, so the input
            is labelled explicitly and the placeholder is only a hint. */}
        <label className="sr-only" htmlFor={inputId}>
          Filter the body catalogue
        </label>
        <input
          id={inputId}
          type="search"
          className={styles.search}
          value={query}
          placeholder="Filter bodies…"
          onChange={(event) => setQuery(event.currentTarget.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {results.length === 0 ? (
        <p className={styles.empty} role="status">
          No body matches “{query.trim()}”. Try a planet or moon name.
        </p>
      ) : (
        <ul className={styles.list}>
          {results.map((entry, index) => (
            <li key={entry.key} style={{ '--index': Math.min(index, 12) } as React.CSSProperties}>
              <button
                type="button"
                className={styles.row}
                data-moon={entry.parent !== null}
                aria-pressed={selectedKey === entry.key}
                onClick={() => select(selectedKey === entry.key ? null : entry.key)}
              >
                <span
                  className={styles.dot}
                  style={{ background: entry.swatch }}
                  aria-hidden="true"
                />
                <span className={styles.name}>{entry.name}</span>
                <span className={styles.kind}>{entry.kind}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
});
