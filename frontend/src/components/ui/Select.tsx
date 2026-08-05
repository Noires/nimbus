import type { ComponentPropsWithRef } from "react";

/** Standard select, matching the Input treatment. */
export function Select({ className, children, ...rest }: ComponentPropsWithRef<"select">) {
  return (
    <select
      className={`rounded-nc-md border border-nc-line-faint bg-nc-well/60 px-2 py-1.5 text-xs text-nc-soft transition-colors${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </select>
  );
}
