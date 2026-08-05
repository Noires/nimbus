import { useStore, CARD_W, CARD_H, type Task } from "../store";

// Level-of-detail stand-ins for cards at low zoom. Both retain a readable,
// keyboard-accessible title and fly the camera in on activation.
export function TaskChip({ task, dot, dimmed }: { task: Task; dot: boolean; dimmed: boolean }) {
  const flyIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    const store = useStore.getState();
    store.flyTo(task.x + CARD_W / 2, task.y + CARD_H / 2, 1);
    store.flashTask(task.id);
  };

  if (dot) {
    return (
      <button
        type="button"
        aria-label={`Open task: ${task.title}`}
        className="absolute cursor-pointer text-left"
        style={{
          left: task.x,
          top: task.y + CARD_H / 2 - 28,
          width: CARD_W,
          height: 56,
          opacity: dimmed ? 0.15 : task.done ? 0.35 : 0.9,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={flyIn}
      >
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: task.color,
            boxShadow: task.done ? undefined : `0 0 18px 4px ${task.color}55`,
          }}
        />
        <span className={`semantic-dot-title absolute left-0 top-full w-full truncate text-center text-[48px] leading-none drop-shadow-md ${task.done ? "line-through text-nc-faint" : "text-nc-text"}`}>
          {task.title}
        </span>
      </button>
    );
  }

  return (
    <div
      className="absolute flex items-center gap-1.5 rounded-full bg-nc-raised/90 border border-nc-line-faint px-2.5 cursor-pointer hover:border-nc-line-strong transition-colors"
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
      <span className={`text-2xs truncate flex-1 ${task.done ? "line-through text-nc-faint" : "text-nc-soft"}`}>
        {task.title}
      </span>
      {task.done && <span className="text-2xs text-nc-success shrink-0">✓</span>}
      {!task.done && task.dueDate && <span className="text-2xs text-nc-muted shrink-0">◷</span>}
    </div>
  );
}
