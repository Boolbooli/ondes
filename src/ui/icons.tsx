import type { JSX } from 'preact';

type IconProps = { size?: number; class?: string };

function Svg({ size = 24, class: className, children, filled }: IconProps & { children: JSX.Element | JSX.Element[]; filled?: boolean }) {
  return (
    <svg
      class={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 20 20" />
  </Svg>
);

export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20" />
    <circle cx="15" cy="7" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);

export const PlayIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <path d="M8 5.6v12.8a1.1 1.1 0 0 0 1.68.93l10.1-6.4a1.1 1.1 0 0 0 0-1.86L9.68 4.67A1.1 1.1 0 0 0 8 5.6z" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <rect x="6" y="5" width="4.2" height="14" rx="1.3" />
    <rect x="13.8" y="5" width="4.2" height="14" rx="1.3" />
  </Svg>
);

export const PrevIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <rect x="5" y="6" width="2.4" height="12" rx="1.2" />
    <path d="M18.5 6.9v10.2a1 1 0 0 1-1.55.83l-7.6-5.1a1 1 0 0 1 0-1.66l7.6-5.1a1 1 0 0 1 1.55.83z" />
  </Svg>
);

export const NextIcon = (p: IconProps) => (
  <Svg {...p} filled>
    <rect x="16.6" y="6" width="2.4" height="12" rx="1.2" />
    <path d="M5.5 6.9v10.2a1 1 0 0 0 1.55.83l7.6-5.1a1 1 0 0 0 0-1.66l-7.6-5.1A1 1 0 0 0 5.5 6.9z" />
  </Svg>
);

function SkipGlyph({ forward, ...p }: IconProps & { forward?: boolean }) {
  return (
    <Svg {...p}>
      <g transform={forward ? 'matrix(-1 0 0 1 24 0)' : undefined}>
        <path d="M5.2 8.6A8 8 0 1 1 4 12.6" />
        <path d="M4.6 3.8v4.9h4.9" />
      </g>
      <text
        x="12.4"
        y="15.6"
        text-anchor="middle"
        fill="currentColor"
        stroke="none"
        style="font: 700 8.2px/1 system-ui, -apple-system, sans-serif; letter-spacing: -0.02em"
      >
        30
      </text>
    </Svg>
  );
}

export const Back30Icon = (p: IconProps) => <SkipGlyph {...p} />;
export const Forward30Icon = (p: IconProps) => <SkipGlyph {...p} forward />;

export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path
      fill={filled ? 'currentColor' : 'none'}
      d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"
    />
  </Svg>
);

export const MoonIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z" />
  </Svg>
);

export const AirPlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1.5" />
    <path d="M12 14.5l4 5H8z" fill="currentColor" stroke-width="1.5" />
  </Svg>
);

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5v11M8 7.2l4-3.7 4 3.7" />
    <path d="M8.5 10.5H6.8A1.8 1.8 0 0 0 5 12.3v6.4a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-6.4a1.8 1.8 0 0 0-1.8-1.8h-1.7" />
  </Svg>
);

export const InfoIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.4" fill="currentColor" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const ArrowUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 19V5.5M6.5 11 12 5.5l5.5 5.5" />
  </Svg>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v13.5M6.5 13l5.5 5.5 5.5-5.5" />
  </Svg>
);

export const RemoveIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8 12h8" />
  </Svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
    <path d="M17 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" />
  </Svg>
);

export const RetryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v4.5H15" />
  </Svg>
);

export const LinkIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);

/** The Ondes mark: a stop ring on a line. */
export const MarkIcon = ({ size = 26, class: className }: IconProps) => (
  <svg class={className} width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
    <path d="M0 13h26" stroke="#D93A2B" stroke-width="5" />
    <circle cx="13" cy="13" r="8.2" fill="#0B1230" stroke="#F6F3EC" stroke-width="3" />
    <circle cx="13" cy="13" r="2.6" fill="#F6F3EC" />
  </svg>
);
