import type { ReactNode } from "react";
import { Button } from "./ui/Button";

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
          <p className="night-cartography__title" data-workspace-title>{title}</p>
          <span data-workspace-label className="sr-only">{title} workspace</span>
          {detail && <p className="night-cartography__detail">{detail}</p>}
        </div>
      </header>
      <div className="night-cartography__body">{children}</div>
    </section>
  );
}

/** Shared list-row grammar for the destination views (Today, Review,
 * Operations …): readable text-sm title that wraps instead of clipping, an
 * optional right badge, a wrapping metadata line, and a wrapping action bar.
 * Keep every class string free of the substring "form" — OperationsView's
 * tests assert its markup never contains it. */
export function NightCartographyTaskRow({
  title,
  titleTone = "text-nc-text",
  badge,
  meta,
  actions,
  className = "",
  actionsClassName = "",
  children,
}: {
  title: ReactNode;
  titleTone?: string;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  actionsClassName?: string;
  children?: ReactNode;
}) {
  return (
    <li className={`night-cartography__task-row rounded-nc-md border border-nc-line-faint bg-nc-well/40 p-3 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <p className={`min-w-0 flex-1 text-sm font-medium leading-snug [overflow-wrap:anywhere] ${titleTone}`}>{title}</p>
        {badge && <span className="shrink-0 text-xs">{badge}</span>}
      </div>
      {children}
      {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-nc-muted">{meta}</div>}
      {actions && <div className={`mt-2.5 flex flex-wrap gap-1.5 ${actionsClassName}`.trim()}>{actions}</div>}
    </li>
  );
}

/** Quiet row action; the label must stay the button's only child. */
export function NightCartographyRowAction({ label, onClick, inspectorTaskId }: {
  label: string;
  onClick: () => void;
  inspectorTaskId?: string;
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} data-mobile-inspector-task={inspectorTaskId}>
      {label}
    </Button>
  );
}
