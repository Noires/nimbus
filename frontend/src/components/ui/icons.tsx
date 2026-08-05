import type { ReactNode } from "react";

/* Hand-drawn 20×20 stroke icons (no icon dependency — project constraint).
 * Every icon is decorative (`aria-hidden`): the OWNING control must carry the
 * accessible name via visible text, sr-only text, or aria-label.
 * Keep every attribute/class here free of the substring "form"
 * (OperationsView markup contract). */
export function Icon({ size = 20, children }: { size?: 16 | 20; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const IconEye = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5Z" /><circle cx="10" cy="10" r="2.2" /></Icon>
);

export const IconUndo = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M4 8.5h8a4 4 0 0 1 0 8H7" /><path d="M7.5 5 4 8.5 7.5 12" /></Icon>
);

export const IconClose = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="m5.5 5.5 9 9M14.5 5.5l-9 9" /></Icon>
);

export const IconArrowLeft = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M16 10H4M8.5 5.5 4 10l4.5 4.5" /></Icon>
);

export const IconPencil = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="m12.3 4.2 3.5 3.5L7 16.5l-4 .9.9-4Z" /><path d="m11 5.5 3.5 3.5" /></Icon>
);

export const IconArchive = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><rect x="3" y="4" width="14" height="4" rx="1" /><path d="M4.5 8v7a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 15.5 15V8" /><path d="M8 11.5h4" /></Icon>
);

export const IconClock = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5V10l2.5 1.8" /></Icon>
);

export const IconTrash = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M4 6h12M8 6V4.5A1 1 0 0 1 9 3.5h2a1 1 0 0 1 1 1V6" /><path d="M5.5 6v9A1.5 1.5 0 0 0 7 16.5h6a1.5 1.5 0 0 0 1.5-1.5V6" /><path d="M8.3 9v4.5M11.7 9v4.5" /></Icon>
);

export const IconRestore = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M3.5 10a6.5 6.5 0 1 1 2 4.7" /><path d="M3.2 16.4v-3.6h3.6" /></Icon>
);

export const IconInboxTray = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M3 11.5V15a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 15v-3.5" /><path d="M3 11.5h4l1.3 2h3.4l1.3-2h4" /><path d="M10 3.5v6M7.5 7.5 10 10l2.5-2.5" /></Icon>
);

export const IconWrench = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M13.5 3.5a4 4 0 0 0-5.2 5L3.5 13.3a1.6 1.6 0 0 0 2.2 2.2l4.8-4.8a4 4 0 0 0 5-5.2l-2.6 2.6-2.2-2.2Z" /></Icon>
);

export const IconDots = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><circle cx="4.5" cy="10" r="1.2" fill="currentColor" stroke="none" /><circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" /><circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none" /></Icon>
);

export const IconLens = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><circle cx="9" cy="9" r="5.5" /><path d="m13 13 3.5 3.5" /></Icon>
);

export const IconFrame = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M3.5 7V4.5A1 1 0 0 1 4.5 3.5H7M13 3.5h2.5a1 1 0 0 1 1 1V7M16.5 13v2.5a1 1 0 0 1-1 1H13M7 16.5H4.5a1 1 0 0 1-1-1V13" /></Icon>
);

export const IconGrid = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><rect x="3.5" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="11" y="3.5" width="5.5" height="5.5" rx="1" /><rect x="3.5" y="11" width="5.5" height="5.5" rx="1" /><rect x="11" y="11" width="5.5" height="5.5" rx="1" /></Icon>
);

export const IconPlus = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M10 4.5v11M4.5 10h11" /></Icon>
);

export const IconLock = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><rect x="4.5" y="9" width="11" height="7.5" rx="1.5" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></Icon>
);

export const IconHourglass = ({ size }: { size?: 16 | 20 }) => (
  <Icon size={size}><path d="M5.5 3.5h9M5.5 16.5h9" /><path d="M6.5 3.5v2.3L10 10l3.5-4.2V3.5M6.5 16.5v-2.3L10 10l3.5 4.2v2.3" /></Icon>
);
