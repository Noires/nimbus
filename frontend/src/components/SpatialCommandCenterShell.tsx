import { IconClose, IconWrench } from "./ui/icons";
import { useEffect, useRef, type KeyboardEvent, type ReactNode, type Ref } from "react";

interface SpatialCommandCenterShellProps {
  navigationLabel: string;
  commandLabel: string;
  railLabel?: string;
  railModal?: boolean;
  railToggle?: boolean;
  openRailLabel?: string;
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
  railModal = false,
  railToggle = false,
  openRailLabel,
  closeRailLabel,
  onCloseRail,
  navigation,
  commands,
  rail,
  fullWidth = false,
  mainRef,
  children,
}: SpatialCommandCenterShellProps) {
  const railOpenerRef = useRef<HTMLButtonElement>(null);
  const railCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (railModal) railCloseRef.current?.focus();
  }, [railModal]);

  const closeModalRail = () => {
    onCloseRail?.();
    queueMicrotask(() => railOpenerRef.current?.focus());
  };

  const trapRailFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeModalRail();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    )).filter((element) => !element.hasAttribute("hidden"));
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
      : (currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    focusable[nextIndex]?.focus();
  };

  return (
    <div id="command-center-tutorial-return" className={`command-center-shell${rail ? " command-center-shell--with-rail" : ""}${fullWidth ? " command-center-shell--workspace" : ""}`} tabIndex={-1}>
      <aside className="command-center-shell__navigation" aria-label={navigationLabel}>
        {navigation}
      </aside>
      <header className="command-center-shell__commands" aria-label={commandLabel}>
        {commands}
        {railToggle && onCloseRail && <button ref={railOpenerRef} type="button" className="command-center-shell__rail-open" onClick={onCloseRail}><IconWrench size={16} /><span className="sr-only">{openRailLabel ?? railLabel ?? "Context"}</span></button>}
      </header>
      <main ref={mainRef} className="command-center-shell__main">
        {children}
      </main>
      {rail && (railModal ? <>
        <button type="button" className="command-center-shell__rail-backdrop" aria-label={closeRailLabel} onClick={closeModalRail} />
        <aside className="command-center-shell__rail" role="dialog" aria-modal="true" aria-label={railLabel ?? "Context"} onKeyDown={trapRailFocus}>
          {onCloseRail && <button ref={railCloseRef} type="button" className="command-center-shell__rail-close" onClick={closeModalRail}><IconClose size={16} /><span className="sr-only">{closeRailLabel}</span></button>}
          {rail}
        </aside>
      </> : <aside className="command-center-shell__rail" aria-label={railLabel ?? "Context"}>
        {onCloseRail && <button type="button" className="command-center-shell__rail-close" onClick={onCloseRail}><IconClose size={16} /><span className="sr-only">{closeRailLabel}</span></button>}
        {rail}
      </aside>)}
    </div>
  );
}
