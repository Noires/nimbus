import type { ComponentPropsWithRef } from "react";

export type ButtonVariant = "accent" | "select" | "ghost" | "quiet" | "danger";
export type ButtonSize = "sm" | "md";

/* Variants harvested from the recurring hand-rolled class strings. HARD RULE:
 * no class string may contain the substring "form" (OperationsView's tests
 * assert its markup never contains it) — so no `transform`,
 * no `transition-transform`. `transition-colors` is fine. */
const VARIANTS: Record<ButtonVariant, string> = {
  accent: "border border-nc-accent-border bg-nc-accent-surface text-nc-accent-strong hover:bg-nc-accent-muted",
  select: "bg-nc-select-surface font-semibold text-nc-text hover:bg-nc-select-surface/80",
  ghost: "border border-nc-line text-nc-text hover:bg-nc-fill",
  quiet: "text-nc-muted hover:bg-nc-fill-faint hover:text-nc-text",
  danger: "border border-nc-danger-border text-nc-danger hover:bg-nc-danger-muted",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "rounded-nc-sm px-2.5 py-1.5 text-xs",
  md: "min-h-11 rounded-nc-md px-3 py-2 text-sm",
};

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** The one button. Children render as the sole content (no wrapper spans) so
 * static-markup tests that anchor on `>Label<` keep holding. */
export function Button({ variant = "ghost", size = "md", className, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export const buttonClassNames = { variants: VARIANTS, sizes: SIZES };
