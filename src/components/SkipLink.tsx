import styles from './SkipLink.module.css';

/**
 * Skip link. The 3D canvas is the first thing in the DOM and is useless to a
 * keyboard user, so the very first Tab press offers a jump past it.
 */
export const SkipLink = () => (
  <a className={styles.skip} href="#controls">
    Skip to simulation controls
  </a>
);
