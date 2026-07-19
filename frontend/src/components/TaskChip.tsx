import { useStore, CARD_W, CARD_H, type Task } from "../store";

// Level-of-detail stand-ins for cards at low zoom. Chips keep title + state;
// dots are pure landmarks. Both fly the camera in on click.
export function TaskChip({ task, dot, dimmed }: { task: Task; dot: boolean; dimmed: boolean }) {
  const flyIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useStore.getState();
    store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
    store.flashTask(task.id);
  };

  if (dot) {
    return (
      <div
        className="absolute rounded-full cursor-pointer"
        style={{
          left: task.x + CARD_W / 2 - 8,
          top: task.y + CARD_H / 2 - 8,
          width: 16,
          height: 16,
          background: task.color,
          opacity: dimmed ? 0.15 : task.done ? 0.35 : 0.9,
          boxShadow: task.done ? undefined : `0 0 18px 4px ${task.color}55`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={flyIn}
        title={task.title}
      />
    );
  }

  return (
    <div
      className="absolute flex items-center gap-1.5 rounded-full bg-[#1a1d24]/90 border border-white/10 px-2.5 cursor-pointer hover:border-white/30 transition-colors"
      style={{
        left: task.x,
        top: task.y + CARD_H / 2 - 14,
        width: CARD_W,
        height: 28,
        opacity: dimmed ? 0.2 : task.done ? 0.5 : 1,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={flyIn}
      title={task.title}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: task.color }} />
      <span className={`text-[11px] truncate flex-1 ${task.done ? "line-through text-gray-500" : "text-gray-300"}`}>
        {task.title}
      </span>
      {task.done && <span className="text-[10px] text-emerald-400 shrink-0">✓</span>}
      {!task.done && task.dueDate && <span className="text-[10px] text-amber-400/80 shrink-0">◷</span>}
    </div>
  );
}
