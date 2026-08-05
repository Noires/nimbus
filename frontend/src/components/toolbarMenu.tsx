import { useEffect, useRef, useState, type ComponentPropsWithRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { menuPop, quickFade } from "../utils/motion";

/** Shared menu grammar for the TopBar and the CanvasToolbar: one open menu at
 * a time, roving focus (Home/End/Arrows), Escape closes and restores the
 * trigger. Extracted from the original Toolbar so both toolbars stay
 * keyboard-identical. */
export function useMenuSet<Name extends string>() {
  const [openName, setOpenName] = useState<Name | null>(null);
  const triggerRefs = useRef<Partial<Record<Name, HTMLButtonElement | null>>>({});
  const menuRefs = useRef<Partial<Record<Name, HTMLDivElement | null>>>({});
  const openRef = useRef(openName);
  openRef.current = openName;

  const setTriggerRef = (name: Name) => (el: HTMLButtonElement | null) => { triggerRefs.current[name] = el; };
  const setMenuRef = (name: Name) => (el: HTMLDivElement | null) => { menuRefs.current[name] = el; };

  const enabledItems = (name: Name) =>
    Array.from(menuRefs.current[name]?.querySelectorAll<HTMLElement>("[role^='menuitem']") ?? [])
      .filter((item) => !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true");

  const open = (name: Name) => setOpenName(name);
  const close = (name: Name, restoreFocus = true) => {
    setOpenName((current) => (current === name ? null : current));
    if (restoreFocus) triggerRefs.current[name]?.focus();
  };
  const closeAll = () => setOpenName(null);
  const isOpen = (name: Name) => openName === name;

  useEffect(() => {
    if (openName) requestAnimationFrame(() => enabledItems(openName)[0]?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openName]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !openRef.current) return;
      close(openRef.current);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTriggerKeyDown = (name: Name) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["Enter", " ", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    open(name);
  };

  const onMenuKeyDown = (name: Name) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = enabledItems(name);
    const focusedItem = document.activeElement instanceof HTMLElement
      ? document.activeElement.closest<HTMLElement>("[role^='menuitem']")
      : null;
    // A key event can bubble from a descendant of an item; resolve it back to
    // the owning menuitem with a safe first-item fallback.
    const targetItem = event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>("[role^='menuitem']")
      : null;
    const currentIndex = items.indexOf(focusedItem ?? targetItem!);
    const index = currentIndex < 0 ? 0 : currentIndex;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(name);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      items[0]?.focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      items[items.length - 1]?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  };

  return { openName, open, close, closeAll, isOpen, setTriggerRef, setMenuRef, onTriggerKeyDown, onMenuKeyDown };
}

/** Animated shell for menus and small popovers: a quick scale-pop from the
 * trigger edge; plain fade under prefers-reduced-motion. Enter-only — menus
 * unmount instantly on close, matching the app-wide pattern. */
export function MenuPanel({ children, style, ...rest }: ComponentPropsWithRef<typeof motion.div>) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={reduced ? quickFade : menuPop}
      style={{ transformOrigin: "top", ...style }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MenuItem({ onClick, children, checked, title, kind = checked === undefined ? "item" : "checkbox" }: { onClick: () => void; children: React.ReactNode; checked?: boolean; title?: string; kind?: "item" | "checkbox" | "radio" }) {
  const role = kind === "radio" ? "menuitemradio" : kind === "checkbox" ? "menuitemcheckbox" : "menuitem";
  return (
    <button
      role={role}
      aria-checked={kind === "item" ? undefined : checked}
      title={title}
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs text-nc-soft hover:bg-nc-fill hover:text-nc-text transition-colors whitespace-normal"
    >
      {checked ? "✓ " : ""}{children}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1.5 pb-0.5 text-2xs uppercase tracking-wider text-nc-soft">{children}</div>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-nc-fill" />;
}
