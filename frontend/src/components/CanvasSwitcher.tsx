import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, type Canvas } from "../store";
import { useT } from "../i18n";
import { dialogSpring } from "../utils/motion";
import { MenuPanel } from "./toolbarMenu";
import { IconPencil, IconTrash } from "./ui/icons";
import { motion } from "framer-motion";

interface CanvasSwitcherProps {
  canvases: Canvas[];
  canvasId: string | null;
}

/** TopBar canvas switcher: replaces the old sidebar CanvasList and all its
 * window.prompt/confirm/alert flows with an in-app popover (inline rename,
 * inline create, alertdialog delete). Errors surface as toasts. */
export function CanvasSwitcher({ canvases, canvasId }: CanvasSwitcherProps) {
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newName, setNewName] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<Canvas | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const current = canvases.find((c) => c.id === canvasId);

  useEffect(() => {
    if (open) requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("a, button, input")?.focus());
  }, [open]);

  useEffect(() => {
    if (deleteCandidate) cancelDeleteRef.current?.focus();
  }, [deleteCandidate]);

  const close = () => {
    setOpen(false);
    setRenamingId(null);
    setDeleteCandidate(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const goTo = (id: string) => {
    close();
    navigate(`/canvas/${id}`);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    try {
      const canvas = await useStore.getState().createCanvas(newName.trim());
      setNewName("");
      close();
      navigate(`/canvas/${canvas.id}`);
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(t("a.canvasList.createFailed"));
    }
  };

  const saveRename = async (canvas: Canvas) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === canvas.name) return;
    await useStore.getState().renameCanvas(canvas.id, name).catch((e) => {
      console.error(e);
      useStore.getState().showToast(t("a.canvasList.renameFailed"));
    });
  };

  const remove = async (canvas: Canvas) => {
    setDeleteCandidate(null);
    try {
      await useStore.getState().deleteCanvas(canvas.id);
      if (canvas.id === canvasId) {
        const rest = useStore.getState().canvases;
        navigate(rest[0] ? `/canvas/${rest[0].id}` : "/", { replace: true });
      }
    } catch (e) {
      console.error(e);
      useStore.getState().showToast(t("a.canvasList.deleteFailed"));
    }
  };

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("d.switcher.open")}
        onClick={() => (open ? close() : setOpen(true))}
        className="canvas-toolbar__primary-action flex max-w-56 items-center gap-1.5"
      >
        <span className="min-w-0 truncate">{current?.name || t("a.canvasList.untitled")}</span>
        <span aria-hidden="true" className="text-nc-faint">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <MenuPanel
            ref={dialogRef}
            role="dialog"
            aria-label={t("a.canvasList.heading")}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
            className="canvas-toolbar__menu"
          >
            <div className="px-3 pt-1.5 pb-0.5 text-2xs uppercase tracking-wider text-nc-soft">{t("a.canvasList.heading")}</div>
            <ul className="m-0 list-none p-0">
              {canvases.map((canvas) => (
                <li key={canvas.id} className="group flex items-center gap-1">
                  {renamingId === canvas.id ? (
                    <form
                      className="flex flex-1 items-center gap-1 px-2 py-1"
                      onSubmit={(event) => { event.preventDefault(); void saveRename(canvas); }}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        aria-label={t("d.switcher.name")}
                        className="min-w-0 flex-1 rounded-nc-sm border border-nc-line bg-nc-well/60 px-2 py-1 text-xs text-nc-text"
                        maxLength={120}
                      />
                      <button type="submit" className="rounded-nc-sm border border-nc-accent-border px-2 py-1 text-xs text-nc-accent-strong hover:bg-nc-accent-muted">{t("d.switcher.save")}</button>
                      <button type="button" onClick={() => setRenamingId(null)} className="rounded-nc-sm px-2 py-1 text-xs text-nc-muted hover:text-nc-text">{t("d.switcher.cancel")}</button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-current={canvas.id === canvasId ? "true" : undefined}
                        onClick={() => goTo(canvas.id)}
                        className={`min-w-0 flex-1 truncate rounded-nc-sm px-3 py-1.5 text-left text-xs transition-colors ${canvas.id === canvasId ? "bg-nc-accent-muted text-nc-accent-strong" : "text-nc-soft hover:bg-nc-fill hover:text-nc-text"}`}
                      >
                        {canvas.name || t("a.canvasList.untitled")}
                      </button>
                      <button
                        type="button"
                        aria-label={`${t("d.switcher.rename")}: ${canvas.name || t("a.canvasList.untitled")}`}
                        title={t("a.canvasList.renameTitle")}
                        onClick={() => { setRenamingId(canvas.id); setRenameValue(canvas.name); }}
                        className="px-1 text-xs text-nc-faint opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 hover:text-nc-text"
                      >
                        <IconPencil size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${t("d.switcher.delete")}: ${canvas.name || t("a.canvasList.untitled")}`}
                        title={t("a.canvasList.deleteTitle")}
                        onClick={() => setDeleteCandidate(canvas)}
                        className="px-1.5 text-xs text-nc-faint opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 hover:text-nc-danger"
                      >
                        <IconTrash size={16} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="my-1 h-px bg-nc-fill" />
            <form onSubmit={(event) => void create(event)} className="flex items-center gap-1 px-2 py-1">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                aria-label={t("d.switcher.newName")}
                placeholder={t("d.switcher.newName")}
                className="min-w-0 flex-1 rounded-nc-sm border border-nc-line bg-nc-well/60 px-2 py-1 text-xs text-nc-text placeholder:text-nc-muted"
                maxLength={120}
              />
              <button type="submit" disabled={!newName.trim()} className="whitespace-nowrap rounded-nc-sm border border-nc-accent-border px-2 py-1 text-xs text-nc-accent-strong hover:bg-nc-accent-muted disabled:cursor-not-allowed disabled:opacity-60">
                {t("d.switcher.create")}
              </button>
            </form>
            {deleteCandidate && (
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="switcher-delete-heading"
                aria-describedby="switcher-delete-detail"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={dialogSpring}
                onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setDeleteCandidate(null); } }}
                className="m-2 rounded-nc-md border border-nc-danger-border bg-nc-raised p-3"
              >
                <h3 id="switcher-delete-heading" className="text-sm font-semibold text-nc-text">{t("d.switcher.deleteTitle")}</h3>
                <p id="switcher-delete-detail" className="mt-1 text-xs text-nc-soft">{t("d.switcher.deleteDetail", { name: deleteCandidate.name || t("a.canvasList.untitled") })}</p>
                <div className="mt-3 flex gap-2">
                  <button ref={cancelDeleteRef} type="button" onClick={() => setDeleteCandidate(null)} className="rounded-nc-md border border-nc-line-faint px-2.5 py-1.5 text-xs text-nc-soft transition-colors hover:bg-nc-fill-faint hover:text-nc-text">{t("d.switcher.cancel")}</button>
                  <button type="button" onClick={() => void remove(deleteCandidate)} className="rounded-nc-md border border-nc-danger-border px-2.5 py-1.5 text-xs text-nc-danger transition-colors hover:bg-nc-danger-muted">{t("d.switcher.deleteConfirm")}</button>
                </div>
              </motion.div>
            )}
          </MenuPanel>
        </>
      )}
    </div>
  );
}
