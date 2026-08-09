import type { ReactNode, SVGProps } from 'react';

/**
 * Icon set — inline SVG, one visual language.
 *
 * Emoji and glyph characters (▶ ❚❚ ✕) are font-dependent, render differently
 * on every platform, cannot inherit a design token, and are announced as
 * arbitrary text by screen readers. These are 24×24, 1.7px stroke, round caps,
 * and inherit `currentColor`.
 *
 * They are decorative: every icon-only control carries its own aria-label, so
 * the SVG itself is hidden from assistive tech.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

const Icon = ({ size = 18, children, ...props }: IconProps & { children: ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {children}
  </svg>
);

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 4.8v14.4a.6.6 0 0 0 .92.5l11.3-7.2a.6.6 0 0 0 0-1l-11.3-7.2a.6.6 0 0 0-.92.5Z" />
  </Icon>
);

export const PauseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 4.5v15M15 4.5v15" />
  </Icon>
);

export const ResetIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4.5V10h5.5" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

/** Concentric orbit mark — used as the brand glyph. */
export const OrbitIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3.2" />
    <ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-22 12 12)" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M15.8 15.8L21 21" />
  </Icon>
);

/** Two bodies on a shared orbit — the satellite marker. */
export const SatelliteIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="4" />
    <ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(-28 12 12)" />
    <circle cx="20" cy="8.2" r="1.6" fill="currentColor" stroke="none" />
  </Icon>
);

/** Concentric rings — the plan view. */
export const MapIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="10" />
  </Icon>
);

export const LayersIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5l8.5 4.3-8.5 4.3-8.5-4.3z" />
    <path d="M3.5 12.5L12 16.8l8.5-4.3" />
    <path d="M3.5 16.7L12 21l8.5-4.3" />
  </Icon>
);

export const KeyboardIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.2" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M8.5 14h7" />
  </Icon>
);
