import type { Prisma } from "@prisma/client";
import prisma from "./prisma-client.js";

export interface EventInput {
  taskId: string;
  canvasId: string;
  type: "created" | "updated" | "moved" | "completed" | "deleted" | "session";
  payload: Prisma.InputJsonValue;
  actor?: string; // "local" (default) | "autopilot" | "capture" | user ids later
}

// History is best-effort: an event-log failure must never fail the mutation.
export async function recordEvent(event: EventInput) {
  try {
    await prisma.taskEvent.create({ data: event });
  } catch (e) {
    console.error("event log failed:", (e as Error).message);
  }
}

export async function recordEvents(events: EventInput[]) {
  if (events.length === 0) return;
  try {
    await prisma.taskEvent.createMany({ data: events });
  } catch (e) {
    console.error("event log failed:", (e as Error).message);
  }
}
