/**
 * Inline SVG icon set — no icon library, no CDN, works offline in the preview.
 * All icons are 24×24 stroke glyphs so they inherit `currentColor`.
 */
import type { ReactElement, SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'camera'
  | 'tasks'
  | 'calendar'
  | 'user'
  | 'sparkles'
  | 'mic'
  | 'search'
  | 'chevronRight'
  | 'chevronLeft'
  | 'close'
  | 'check'
  | 'upload'
  | 'edit'
  | 'trash'
  | 'alert'
  | 'info'
  | 'clock'
  | 'pin'
  | 'bell'
  | 'brain'
  | 'send'
  | 'plus'
  | 'refresh'
  | 'book'
  | 'image'
  | 'bolt'
  | 'target'
  | 'flag'
  | 'list'
  | 'star'
  | 'wifiOff'
  | 'stop';

const PATHS: Record<IconName, ReactElement> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h3.2v-5.2a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 1V21h3.2a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8.8A1.8 1.8 0 0 1 4.8 7h2.1a1.8 1.8 0 0 0 1.6-.95l.55-1A1.8 1.8 0 0 1 10.6 4h2.8a1.8 1.8 0 0 1 1.55.9l.6 1.1A1.8 1.8 0 0 0 17.1 7h2.1A1.8 1.8 0 0 1 21 8.8v9.4A1.8 1.8 0 0 1 19.2 20H4.8A1.8 1.8 0 0 1 3 18.2Z" />
      <circle cx="12" cy="13" r="3.6" />
    </>
  ),
  tasks: (
    <>
      <path d="M4 6.5h2.2l1.2 1.3 2.1-2.6" />
      <path d="M4 17h2.2l1.2 1.3 2.1-2.6" />
      <path d="M12.5 7H20M12.5 17H20" />
      <path d="M12.5 11.5H20M4 11.5h5.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3.2v3.4M16 3.2v3.4" />
      <path d="M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.8 20c.7-3.5 3.6-5.5 7.2-5.5s6.5 2 7.2 5.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3.6 1.7 4.4 4.4 1.7-4.4 1.7L12 15.8l-1.7-4.4-4.4-1.7 4.4-1.7Z" />
      <path d="M18.5 15.2l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8ZM5.5 14.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.8" width="6" height="11" rx="3" />
      <path d="M5.5 11.2a6.5 6.5 0 0 0 13 0M12 17.7V21M9 21h6" />
    </>
  ),
  stop: <rect x="7" y="7" width="10" height="10" rx="2.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.4" />
      <path d="m16 16 4.2 4.2" />
    </>
  ),
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m4.8 12.6 4.6 4.6L19.2 7" />,
  upload: (
    <>
      <path d="M12 16V4.6M8.2 8.2 12 4.4l3.8 3.8" />
      <path d="M4.5 15v3.4a1.6 1.6 0 0 0 1.6 1.6h11.8a1.6 1.6 0 0 0 1.6-1.6V15" />
    </>
  ),
  edit: (
    <>
      <path d="M4.5 19.5h3.2l9.4-9.4a2.2 2.2 0 0 0-3.2-3.2l-9.4 9.4Z" />
      <path d="m13.4 7.4 3.2 3.2" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6.5 7l.8 12.1A1.6 1.6 0 0 0 8.9 20.6h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7" />
      <path d="M10.5 11v5.5M13.5 11v5.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4.6 2.9 19.2A1 1 0 0 0 3.8 20.7h16.4a1 1 0 0 0 .9-1.5Z" />
      <path d="M12 10v4M12 17.2v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 11v5.2M12 7.9v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3 1.8" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6.5-5.6 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3.4.8 5 1.7 6H4.8c.9-1 1.7-2.6 1.7-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5.2v13.6" />
      <path d="M9.4 5.6A2.9 2.9 0 0 0 6.6 8a2.7 2.7 0 0 0-1.4 4.4A2.9 2.9 0 0 0 7 17.4a2.8 2.8 0 0 0 5 .4" />
      <path d="M14.6 5.6A2.9 2.9 0 0 1 17.4 8a2.7 2.7 0 0 1 1.4 4.4 2.9 2.9 0 0 1-1.8 5 2.8 2.8 0 0 1-5 .4" />
    </>
  ),
  send: (
    <>
      <path d="M4.4 11.6 20 4.4l-7.2 15.6-2-6.4Z" />
      <path d="m10.8 13.6 4.4-4.4" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4.6V10h-5.4" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.8h9.6A3.4 3.4 0 0 1 18 8.2V20H8.4A3.4 3.4 0 0 1 5 16.6Z" />
      <path d="M5 16.6A3.4 3.4 0 0 1 8.4 20M18 8.2V20" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4.6 17.4 4.3-4a1.6 1.6 0 0 1 2.2 0l3.1 2.9a1.6 1.6 0 0 0 2.2 0l3-2.8" />
    </>
  ),
  bolt: <path d="M13.4 3 5.8 13.2h5.1L10 21l7.8-10.4h-5.2Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4.2M6 4.8h11.6l-2 3.6 2 3.6H6" />
    </>
  ),
  list: <path d="M4.5 7h15M4.5 12h15M4.5 17h9.5" />,
  star: <path d="m12 4 2.4 5 5.4.7-3.9 3.7 1 5.4-4.9-2.7-4.9 2.7 1-5.4-3.9-3.7 5.4-.7Z" />,
  wifiOff: (
    <>
      <path d="M3 4.5 21 20" />
      <path d="M5.2 10.4a11 11 0 0 1 3.3-2M2 7.2a15 15 0 0 1 4.4-2.7M14.4 5.1A15 15 0 0 1 22 7.2M18.8 10.4a11 11 0 0 0-2.3-1.6M8.6 13.7a6.6 6.6 0 0 1 5.2-.6" />
      <path d="M12 18.4v.1" />
    </>
  ),
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, strokeWidth = 1.7, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
