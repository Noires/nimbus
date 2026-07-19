import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store";

export function Toast() {
  const toast = useStore((s) => s.toast);

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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-lg bg-[#1a1d24]/95 border border-white/15 shadow-2xl text-sm text-gray-200 pointer-events-none"
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
