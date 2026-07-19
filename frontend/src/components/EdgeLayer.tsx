import { useStore, CARD_W, CARD_H, type Task } from "../store";
import { useT } from "../i18n";

// Dependency threads: curved arrows from blocker → blocked, drawn in world
// space. Click a thread to remove it.
export function EdgeLayer({ tasks }: { tasks: Task[] }) {
  const t = useT();
  const dependencies = useStore((s) => s.dependencies);
  const linking = useStore((s) => s.linking);

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const edges = dependencies
    .map((d) => {
      const blocker = byId.get(d.blockerId);
      const blocked = byId.get(d.blockedId);
      return blocker && blocked ? { d, blocker, blocked } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const linkSource = linking ? byId.get(linking.fromId) : null;
  if (edges.length === 0 && !linkSource) return null;

  const path = (from: Task, to: Task) => {
    const x1 = from.x + CARD_W;
    const y1 = from.y + CARD_H / 2;
    const x2 = to.x;
    const y2 = to.y + CARD_H / 2;
    const bend = Math.max(60, Math.abs(x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
  };

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width="1"
      height="1"
      style={{ overflow: "visible" }}
    >
      <defs>
        <marker id="dep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148, 163, 184, 0.7)" />
        </marker>
      </defs>

      {edges.map(({ d, blocker, blocked }) => (
        <path
          key={d.id}
          d={path(blocker, blocked)}
          fill="none"
          stroke={blocker.done ? "rgba(52, 211, 153, 0.45)" : "rgba(148, 163, 184, 0.5)"}
          strokeWidth="2"
          strokeDasharray={blocker.done ? "4 6" : undefined}
          markerEnd="url(#dep-arrow)"
          style={{ pointerEvents: "stroke", cursor: "pointer" }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (confirm(t("b.edge.removeConfirm"))) {
              useStore.getState().removeDependency(d.id).catch((err) => console.error(err));
            }
          }}
        >
          <title>
            {t("b.edge.title", { blocked: blocked.title, blocker: blocker.title })}
          </title>
        </path>
      ))}

      {/* Live linking line while dragging from a port */}
      {linkSource && linking && (
        <path
          d={`M ${linkSource.x + CARD_W} ${linkSource.y + CARD_H / 2} L ${linking.x} ${linking.y}`}
          fill="none"
          stroke="rgba(34, 211, 238, 0.8)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
      )}
    </svg>
  );
}
