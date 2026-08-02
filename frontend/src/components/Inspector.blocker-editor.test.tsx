// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { Task } from "../store";
import { TaskInspector } from "./Inspector";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const task = (id: string, title: string): Task => ({
  id, canvasId: "canvas-1", x: 0, y: 0, z: 0, title, description: "", tags: [], color: "#000", dueDate: null,
  priority: "medium", done: false, archivedAt: null, createdAt: "2026-08-02T00:00:00.000Z", inbox: false,
  snoozedUntil: null, estimateMinutes: null, recurrence: null, lastActivityAt: "2026-08-02T00:00:00.000Z",
  actualMinutes: 0, provider: null, connectionId: null, externalKey: null, externalUrl: null, status: null,
  externalMeta: null, syncedAt: null, checklist: [],
});

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe("TaskInspector blocker editor", () => {
  it("single-flights a mutation and keeps controls disabled with an announced saving state", async () => {
    const target = task("target", "Target");
    const existing = task("existing", "Existing blocker");
    const replacement = task("replacement", "Replacement blocker");
    let resolveMutation: (() => void) | undefined;
    const mutation = new Promise<void>((resolve) => { resolveMutation = resolve; });
    const onSetBlocker = (...args: [string, string | null]) => {
      calls.push(args);
      return mutation;
    };
    const calls: Array<[string, string | null]> = [];

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(<TaskInspector task={target} tasks={[target, existing, replacement]} workstreams={[]} dependencies={[{ id: "dep", blockerId: existing.id, blockedId: target.id }]} onBack={() => {}} blockerEditor={{ enabled: true, onSetBlocker }} />);
    });

    const select = host.querySelector("select")!;
    await act(async () => {
      select.value = replacement.id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const [replace, clear] = [...host.querySelectorAll("button")].filter((button) => /Replace blocker|Clear blocker/.test(button.textContent ?? ""));
    act(() => replace.click());

    expect(calls).toEqual([[target.id, replacement.id]]);
    expect(select.disabled).toBe(true);
    expect(replace.disabled).toBe(true);
    expect(clear.disabled).toBe(true);
    expect(host.textContent).toContain("Saving blocker…");
    act(() => clear.click());
    expect(calls).toHaveLength(1);

    await act(async () => { resolveMutation!(); await mutation; });
    expect(select.value).toBe(replacement.id);
    expect(select.disabled).toBe(false);
    expect(host.textContent).not.toContain("Saving blocker…");

    await act(async () => {
      root!.render(<TaskInspector task={target} tasks={[target, existing, replacement]} workstreams={[]} dependencies={[{ id: "dep-next", blockerId: replacement.id, blockedId: target.id }]} onBack={() => {}} blockerEditor={{ enabled: true, onSetBlocker }} />);
    });
    expect((host.querySelector("select")!).value).toBe(replacement.id);

    await act(async () => {
      root!.render(<TaskInspector task={target} tasks={[target, existing, replacement]} workstreams={[]} dependencies={[]} onBack={() => {}} blockerEditor={{ enabled: true, onSetBlocker }} />);
    });
    expect((host.querySelector("select")!).value).toBe("");
  });
});
