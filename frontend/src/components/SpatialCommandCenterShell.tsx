import type { ReactNode, Ref } from "react";

interface SpatialCommandCenterShellProps {
  navigationLabel: string;
  commandLabel: string;
  railLabel?: string;
  closeRailLabel?: string;
  onCloseRail?: () => void;
  navigation: ReactNode;
  commands: ReactNode;
  rail?: ReactNode;
  fullWidth?: boolean;
  mainRef?: Ref<HTMLElement>;
  children: ReactNode;
}

export function SpatialCommandCenterShell({
  navigationLabel,
  commandLabel,
  railLabel,
  closeRailLabel,
  onCloseRail,
  navigation,
  commands,
  rail,
  fullWidth = false,
  mainRef,
  children,
}: SpatialCommandCenterShellProps) {
  return (
    <div id="command-center-tutorial-return" className={`command-center-shell${rail ? " command-center-shell--with-rail" : ""}${fullWidth ? " command-center-shell--workspace" : ""}`} tabIndex={-1}>
      <aside className="command-center-shell__navigation" aria-label={navigationLabel}>
        {navigation}
      </aside>
      <header className="command-center-shell__commands" aria-label={commandLabel}>
        {commands}
      </header>
      <main ref={mainRef} className="command-center-shell__main">
        {children}
      </main>
      {rail && (
        <aside className="command-center-shell__rail" aria-label={railLabel ?? "Context"}>
          {onCloseRail && <button type="button" className="command-center-shell__rail-close" onClick={onCloseRail}>{closeRailLabel}</button>}
          {rail}
        </aside>
      )}
    </div>
  );
}
