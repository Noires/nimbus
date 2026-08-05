import type { ComponentPropsWithRef } from "react";

/** Standard text input: sunken well, quiet border; the global yellow
 * :focus-visible outline is the one and only focus indicator. */
export function Input({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return (
    <input
      className={`rounded-nc-md border border-nc-line-faint bg-nc-well/60 px-2 py-1.5 text-xs text-nc-text transition-colors placeholder:text-nc-muted${className ? ` ${className}` : ""}`}
      {...rest}
    />
  );
}
