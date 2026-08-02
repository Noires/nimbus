import type { ReactNode } from "react";

type CommandCenterStateKind = "loading" | "error" | "empty";

export function CommandCenterState({ kind, title, detail, action }: {
  kind: CommandCenterStateKind;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  const isLoading = kind === "loading";
  return <section className={`command-center-state command-center-state--${kind}`} aria-busy={isLoading || undefined} aria-live={isLoading ? "polite" : undefined}>
    <div className="command-center-state__icon" aria-hidden="true">{isLoading ? "…" : kind === "error" ? "!" : "○"}</div>
    <div>
      <h1 className="command-center-state__title" {...(kind === "error" ? { role: "alert" } : {})}>{title}</h1>
      <p className="command-center-state__detail">{detail}</p>
      {action && <div className="command-center-state__action">{action}</div>}
    </div>
  </section>;
}
