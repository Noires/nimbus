import type { ReactNode, Ref } from "react";

interface SpatialCommandCenterShellProps {
  navigationLabel: string;
  commandLabel: string;
  railLabel?: string;
  navigation: ReactNode;
  commands: ReactNode;
  rail?: ReactNode;
  mainRef?: Ref<HTMLElement>;
  children: ReactNode;
}

export function SpatialCommandCenterShell({
  navigationLabel,
  commandLabel,
  railLabel,
  navigation,
  commands,
  rail,
  mainRef,
  children,
}: SpatialCommandCenterShellProps) {
  return (
    <div className={`command-center-shell${rail ? " command-center-shell--with-rail" : ""}`}>
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
        <aside className="command-center-shell__rail" aria-label={railLabel}>
          {rail}
        </aside>
      )}
    </div>
  );
}
