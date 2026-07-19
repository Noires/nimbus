import type { Connection, Task } from "@prisma/client";

// Provider contract: everything the sync engine needs from an external
// system. GitHub is provider #1; Jira/GitLab implement the same interface.

export interface RemoteIssue {
  key: string; // "github:owner/repo#123" — globally unique across providers
  number: number;
  nodeId: string; // GraphQL id (Projects v2 add-item)
  title: string;
  body: string; // normalized: never null
  state: "open" | "closed";
  url: string;
  labels: string[];
  assignee: string | null;
  updatedAt: string; // ISO
  isPullRequest: boolean;
}

export interface Column {
  id: string | null; // Projects v2 option id; null in label mode
  name: string;
}

export interface RemoteComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  url: string;
}

export interface ListResult {
  notModified: boolean;
  issues: RemoteIssue[];
  etag?: string;
}

export interface StatusEntry {
  key: string;
  status: string;
  projectItemId: string;
}

export interface ValidateResult {
  /** Extra config resolved during validation (projectId, statusFieldId, …). */
  configPatch: Record<string, unknown>;
  columns: Column[];
}

export interface PushResult {
  remoteUpdatedAt?: string;
  projectItemId?: string; // returned when the push had to add the item to a board
}

export interface Provider {
  kind: string;
  /** Throws ProviderError on bad repo/project/token. */
  validate(conn: Connection): Promise<ValidateResult>;
  listChanged(conn: Connection, since: Date | null): Promise<ListResult>;
  /** Project mode: current status per board item. Label mode: null. */
  listStatuses(conn: Connection): Promise<StatusEntry[] | null>;
  getColumns(conn: Connection): Promise<Column[]>;
  /** Label-mode status derivation from an issue snapshot; null in project mode. */
  deriveStatus(conn: Connection, issue: RemoteIssue): string | null;
  pushFields(
    conn: Connection,
    task: Task,
    fields: { title?: string; body?: string; state?: "open" | "closed" },
  ): Promise<PushResult>;
  setStatus(conn: Connection, task: Task, statusName: string): Promise<PushResult>;
  listComments(conn: Connection, task: Task): Promise<RemoteComment[]>;
  addComment(conn: Connection, task: Task, body: string): Promise<RemoteComment>;
}

export class ProviderError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
