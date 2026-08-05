import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useStore } from "../store";
import { chromeSpring, quickFade } from "../utils/motion";

export function Toast() {
  const toast = useStore((s) => s.toast);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      if (useStore.getState().toast?.id === toast.id) {
        useStore.setState({ toast: null });
      }
    }, 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={reduced ? quickFade : chromeSpring}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-nc-md bg-nc-raised/95 border border-nc-line shadow-nc-lg text-sm text-nc-text pointer-events-none"
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
