import type { ReactNode } from "react";

export type WorkspaceKind = "canvas" | "inbox" | "today" | "review" | "operations" | "ledger" | "utilities";

/** Shared destination chrome. It deliberately contains no mutations: destinations
 * keep using the existing store callbacks while sharing one visual hierarchy. */
export function NightCartographySurface({ kind, title, detail, children }: {
  kind: WorkspaceKind;
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className={`night-cartography night-cartography--${kind}`} data-workspace={kind}>
      <header className="night-cartography__header">
        <div>
          <p className="night-cartography__eyebrow">Night Cartography</p>
          <p className="night-cartography__title" data-workspace-title>{title}</p>
          <span data-workspace-label className="sr-only">{title} workspace</span>
          {detail && <p className="night-cartography__detail">{detail}</p>}
        </div>
      </header>
      <div className="night-cartography__body">{children}</div>
    </section>
  );
}

export function NightCartographyTaskRow({ children }: { children: ReactNode }) {
  return <div className="night-cartography__task-row">{children}</div>;
}
