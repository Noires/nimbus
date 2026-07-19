import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../data/api";
import { useStore, type Task } from "../store";
import { useT, dateLocale } from "../i18n";

interface Frame {
  time: number;
  x: number;
  y: number;
}

interface Track {
  id: string;
  title: string;
  color: string;
  frames: Frame[];
  created: number | null;
  deleted: number | null;
  doneAt: number | null;
}

const PLAY_MS = 10_000;

// Rebuild board state at any moment from the event log and replay it.
export function TimelapseBar({ canvasId, onClose }: { canvasId: string; onClose: () => void }) {
  const [range, setRange] = useState<{ t0: number; t1: number } | null>(null);
  const [t, setT] = useState(1); // normalized 0..1
  const [playing, setPlaying] = useState(false);
  const tracks = useRef<Map<string, Track>>(new Map());
  const playRaf = useRef(0);
  const tr = useT();

  useEffect(() => {
    let cancelled = false;
    api
      .canvasEvents(canvasId)
      .then(({ events }) => {
        if (cancelled) return;
        const map = new Map<string, Track>();
        const ensure = (id: string): Track => {
          let track = map.get(id);
          if (!track) {
            track = { id, title: "…", color: "#6366f1", frames: [], created: null, deleted: null, doneAt: null };
            map.set(id, track);
          }
          return track;
        };

        const t1 = Date.now();
        let t0 = t1 - 86_400_000;
        for (const e of events) {
          const time = Date.parse(e.createdAt);
          t0 = Math.min(t0, time);
          const track = ensure(e.taskId);
          const p = e.payload as Record<string, unknown>;
          if (e.type === "created") {
            track.created = time;
            if (typeof p.title === "string") track.title = p.title;
            if (typeof p.color === "string") track.color = p.color;
            if (typeof p.x === "number" && typeof p.y === "number") {
              track.frames.push({ time, x: p.x, y: p.y });
            }
          } else if (e.type === "moved") {
            const prev = p.prev as { x?: number; y?: number } | undefined;
            if (track.frames.length === 0 && prev && typeof prev.x === "number") {
              track.frames.push({ time: 0, x: prev.x, y: prev.y as number });
            }
            if (typeof p.x === "number" && typeof p.y === "number") {
              track.frames.push({ time, x: p.x, y: p.y });
            }
          } else if (e.type === "completed") {
            track.doneAt = time;
          } else if (e.type === "deleted") {
            track.deleted = time;
            const snap = p.snapshot as { title?: string; color?: string } | undefined;
            if (snap?.title && track.title === "…") track.title = snap.title;
            if (snap?.color) track.color = snap.color;
          }
        }

        // Seed/finish tracks from present-day tasks (covers pre-log history).
        for (const task of useStore.getState().tasks) {
          const track = ensure(task.id);
          track.title = task.title;
          track.color = task.color;
          track.frames.push({ time: t1, x: task.x, y: task.y });
          if (track.frames.length === 1) track.frames.unshift({ time: 0, x: task.x, y: task.y });
          if (task.done && track.doneAt === null) track.doneAt = t1;
        }

        tracks.current = map;
        setRange({ t0, t1 });
        setT(0);
        setPlaying(true);
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
      cancelAnimationFrame(playRaf.current);
      useStore.getState().setReplayTasks(null);
    };
  }, [canvasId]);

  // Apply ghosts whenever the scrub position changes.
  useEffect(() => {
    if (!range) return;
    const T = range.t0 + (range.t1 - range.t0) * t;
    const ghosts: Task[] = [];
    for (const track of tracks.current.values()) {
      if (track.created !== null && T < track.created) continue;
      if (track.deleted !== null && T > track.deleted) continue;
      if (track.frames.length === 0) continue;

      let x = track.frames[0].x;
      let y = track.frames[0].y;
      for (let i = 0; i < track.frames.length; i++) {
        const frame = track.frames[i];
        if (frame.time <= T) {
          const next = track.frames[i + 1];
          if (next && next.time > T && next.time !== frame.time) {
            const k = (T - frame.time) / (next.time - frame.time);
            x = frame.x + (next.x - frame.x) * k;
            y = frame.y + (next.y - frame.y) * k;
          } else {
            x = frame.x;
            y = frame.y;
          }
        }
      }

      ghosts.push({
        id: track.id,
        canvasId,
        x,
        y,
        z: 0,
        title: track.title,
        description: "",
        tags: [],
        color: track.color,
        dueDate: null,
        priority: "medium",
        done: track.doneAt !== null && T >= track.doneAt,
        archivedAt: null,
        createdAt: "",
        inbox: false,
        snoozedUntil: null,
        estimateMinutes: null,
        recurrence: null,
        lastActivityAt: new Date(T).toISOString(),
        actualMinutes: 0,
        provider: null,
        connectionId: null,
        externalKey: null,
        externalUrl: null,
        status: null,
        externalMeta: null,
        syncedAt: null,
        checklist: [],
      });
    }
    useStore.getState().setReplayTasks(ghosts);
  }, [t, range, canvasId]);

  // Play: sweep the range over 10 seconds.
  useEffect(() => {
    if (!playing || !range) return;
    const startWall = performance.now();
    const startT = t >= 1 ? 0 : t;
    const step = (now: number) => {
      const p = Math.min(startT + (now - startWall) / PLAY_MS, 1);
      setT(p);
      if (p < 1) playRaf.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    playRaf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(playRaf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, range]);

  const current = range ? new Date(range.t0 + (range.t1 - range.t0) * t) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-3 rounded-xl bg-[#1a1d24]/95 backdrop-blur-md border border-purple-500/30 px-4 py-2.5 shadow-2xl w-[min(640px,90%)]"
    >
      <button
        onClick={() => setPlaying(!playing)}
        className="w-8 h-8 rounded-lg bg-purple-600/60 hover:bg-purple-600 text-white text-sm shrink-0 transition-colors"
        title={playing ? tr("c.timelapse.pause") : tr("c.timelapse.replay")}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(t * 1000)}
        onChange={(e) => {
          setPlaying(false);
          setT(Number(e.target.value) / 1000);
        }}
        className="flex-1 accent-purple-500"
      />
      <span className="text-[10px] text-gray-400 whitespace-nowrap w-32 text-right">
        {current ? current.toLocaleString(dateLocale()) : tr("c.timelapse.loading")}
      </span>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-sm shrink-0">
        ×
      </button>
    </motion.div>
  );
}
