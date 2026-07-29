// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../data/api";
import { TaskRetrieval } from "./TaskRetrieval";

function task(overrides: Partial<Task> & Pick<Task, "id" | "title">): Task {
  const { id, title, ...rest } = overrides;

  return {
    id,
    canvasId: "canvas-1",
    x: 120,
    y: 240,
    z: 0,
    title,
    description: "",
    tags: [],
    color: "#6366f1",
    dueDate: null,
    priority: "medium",
    done: false,
    archivedAt: null,
    createdAt: "2026-07-29T00:00:00.000Z",
    inbox: false,
    snoozedUntil: null,
    estimateMinutes: null,
    recurrence: null,
    lastActivityAt: "2026-07-29T00:00:00.000Z",
    actualMinutes: 0,
    provider: null,
    connectionId: null,
    externalKey: null,
    externalUrl: null,
    status: null,
    externalMeta: null,
    syncedAt: null,
    checklist: [],
    ...rest,
  };
}

describe("TaskRetrieval", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps results empty until input matches, opens the Inspector from a task result, and reveals explicitly", async () => {
    const alpha = task({ id: "alpha", title: "Alpha plan" });
    const openInspector = vi.fn();
    const reveal = vi.fn();

    await act(async () => {
      root.render(<TaskRetrieval tasks={[alpha]} onOpenInspector={openInspector} onReveal={reveal} />);
    });

    const input = container.querySelector<HTMLInputElement>('input[aria-label="Search tasks"]');
    expect(input).not.toBeNull();
    expect(container.textContent).not.toContain(alpha.title);

    const typeQuery = async () => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "alpha");
        input!.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    await typeQuery();

    expect(container.textContent).toContain(alpha.title);
    expect(container.textContent).toContain("Reveal");

    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Reveal")?.click();
    });
    expect(reveal).toHaveBeenCalledWith(alpha);
    expect(container.textContent).not.toContain(alpha.title);

    await typeQuery();
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent === alpha.title)?.click();
    });
    expect(openInspector).toHaveBeenCalledWith(alpha);
  });
});
