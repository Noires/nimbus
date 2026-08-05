import type { ComponentPropsWithRef } from "react";

export type ChipTone = "neutral" | "accent" | "danger" | "warning";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-nc-fill-faint text-nc-soft",
  accent: "bg-nc-accent-muted text-nc-accent-strong",
  danger: "bg-nc-danger-muted text-nc-danger",
  warning: "bg-nc-warning-muted text-nc-warning",
};

/** Small metadata pill (tags, priorities, statuses). */
export function Chip({ tone = "neutral", className, children, ...rest }: ComponentPropsWithRef<"span"> & { tone?: ChipTone }) {
  return (
    <span className={`inline-flex items-center rounded-nc-sm px-1.5 py-0.5 text-xs ${TONES[tone]}${className ? ` ${className}` : ""}`} {...rest}>
      {children}
    </span>
  );
}
