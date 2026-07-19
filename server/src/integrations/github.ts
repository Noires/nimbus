import type { Connection, Task } from "@prisma/client";
import {
  ProviderError,
  type Column,
  type ListResult,
  type Provider,
  type PushResult,
  type RemoteComment,
  type RemoteIssue,
  type StatusEntry,
  type ValidateResult,
} from "./types.js";

// GitHub provider: REST for issues/comments, GraphQL only for Projects v2.
// Status semantics:
//   Label mode  — column encoded as a `status:<slug>` label; the "Done"
//                 column also closes the issue (leaving it reopens).
//   Project mode — column = the linked Projects v2 board's "Status"
//                 single-select field; "Done" additionally closes the issue.

interface GithubConfig {
  owner: string;
  repo: string;
  projectNumber?: number;
  projectOwner?: string;
  labels?: string[];
  assignee?: string;
  placement?: "inbox" | "canvas";
  bubbleId?: string;
  anchorX?: number;
  anchorY?: number;
  projectId?: string;
  statusFieldId?: string;
  labelColumns?: string[];
}

const DEFAULT_COLUMNS = ["Todo", "In Progress", "Done"];
const STATUS_PREFIX = "status:";

function apiBase(): string {
  return process.env.GITHUB_API_URL ?? "https://api.github.com";
}

function token(): string {
  const value = process.env.GITHUB_TOKEN;
  if (!value) throw new ProviderError(401, "GITHUB_TOKEN is not configured in server/.env");
  return value;
}

function cfg(conn: Connection): GithubConfig {
  return conn.config as unknown as GithubConfig;
}

function meta(task: Task): Record<string, unknown> {
  return (task.externalMeta as Record<string, unknown>) ?? {};
}

function slugOf(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function isDoneColumn(name: string): boolean {
  return name.trim().toLowerCase() === "done";
}

async function ghFetch(path: string, init?: RequestInit & { allow304?: boolean }): Promise<Response> {
  const { allow304, ...rest } = init ?? {};
  const res = await fetch(`${apiBase()}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "task-dashboard",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
  });
  if (!res.ok && !(allow304 && res.status === 304)) {
    const body = await res.text().catch(() => "");
    throw new ProviderError(res.status, body.slice(0, 300) || res.statusText);
  }
  return res;
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await ghFetch("/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new ProviderError(502, json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new ProviderError(502, "Empty GraphQL response");
  return json.data;
}

interface RawIssue {
  number: number;
  node_id: string;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  labels: Array<{ name: string } | string>;
  assignee: { login: string } | null;
  updated_at: string;
  pull_request?: unknown;
}

function toRemote(conn: Connection, raw: RawIssue): RemoteIssue {
  const { owner, repo } = cfg(conn);
  return {
    key: `github:${owner}/${repo}#${raw.number}`,
    number: raw.number,
    nodeId: raw.node_id,
    title: raw.title,
    body: raw.body ?? "",
    state: raw.state === "closed" ? "closed" : "open",
    url: raw.html_url,
    labels: raw.labels.map((l) => (typeof l === "string" ? l : l.name)),
    assignee: raw.assignee?.login ?? null,
    updatedAt: raw.updated_at,
    isPullRequest: raw.pull_request !== undefined,
  };
}

// --- Projects v2 GraphQL ---

interface StatusField {
  id: string;
  options: Array<{ id: string; name: string }>;
}

const PROJECT_FIELD_FRAGMENT = `
  projectV2(number: $number) {
    id
    field(name: "Status") {
      ... on ProjectV2SingleSelectField { id options { id name } }
    }
  }`;

async function resolveProject(conn: Connection): Promise<{ projectId: string; field: StatusField }> {
  const { owner, repo, projectNumber, projectOwner } = cfg(conn);
  const login = projectOwner ?? owner;
  type ProjectNode = { id: string; field: StatusField | null } | null;

  let project: ProjectNode = null;
  try {
    const data = await gql<{ repository: { projectV2: ProjectNode } | null }>(
      `query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { ${PROJECT_FIELD_FRAGMENT} } }`,
      { owner, repo, number: projectNumber },
    );
    project = data.repository?.projectV2 ?? null;
  } catch { /* fall through to org/user lookup */ }

  if (!project) {
    try {
      const data = await gql<{ organization: { projectV2: ProjectNode } | null }>(
        `query($login: String!, $number: Int!) { organization(login: $login) { ${PROJECT_FIELD_FRAGMENT} } }`,
        { login, number: projectNumber },
      );
      project = data.organization?.projectV2 ?? null;
    } catch { /* fall through */ }
  }
  if (!project) {
    const data = await gql<{ user: { projectV2: ProjectNode } | null }>(
      `query($login: String!, $number: Int!) { user(login: $login) { ${PROJECT_FIELD_FRAGMENT} } }`,
      { login, number: projectNumber },
    );
    project = data.user?.projectV2 ?? null;
  }

  if (!project) throw new ProviderError(404, `Project #${projectNumber} not found for '${login}'`);
  if (!project.field?.options)
    throw new ProviderError(400, `Project #${projectNumber} has no single-select "Status" field`);
  return { projectId: project.id, field: project.field };
}

export const github: Provider = {
  kind: "github",

  async validate(conn): Promise<ValidateResult> {
    const { owner, repo, projectNumber } = cfg(conn);
    if (!owner || !repo) throw new ProviderError(400, "owner and repo are required");
    await ghFetch(`/repos/${owner}/${repo}`);

    if (projectNumber) {
      const { projectId, field } = await resolveProject(conn);
      return {
        configPatch: { projectId, statusFieldId: field.id },
        columns: field.options.map((o) => ({ id: o.id, name: o.name })),
      };
    }
    const columns = (cfg(conn).labelColumns ?? DEFAULT_COLUMNS).map((name) => ({ id: null, name }));
    return { configPatch: {}, columns };
  },

  async listChanged(conn, since): Promise<ListResult> {
    const { owner, repo, labels, assignee } = cfg(conn);
    const issues: RemoteIssue[] = [];
    let etag: string | undefined;

    for (let page = 1; page <= 10; page++) {
      const params = new URLSearchParams({
        state: "all",
        per_page: "100",
        page: String(page),
        sort: "updated",
        direction: "asc",
      });
      if (since) params.set("since", since.toISOString());
      if (labels?.length) params.set("labels", labels.join(","));
      if (assignee) params.set("assignee", assignee);

      const res = await ghFetch(`/repos/${owner}/${repo}/issues?${params}`, {
        allow304: page === 1,
        headers: page === 1 && conn.etag ? { "If-None-Match": conn.etag } : {},
      });
      if (res.status === 304) return { notModified: true, issues: [] };
      if (page === 1) etag = res.headers.get("etag") ?? undefined;

      const batch = (await res.json()) as RawIssue[];
      issues.push(...batch.map((raw) => toRemote(conn, raw)));
      if (batch.length < 100) break;
    }

    return { notModified: false, issues, etag };
  },

  async listStatuses(conn): Promise<StatusEntry[] | null> {
    const { projectId, owner, repo } = cfg(conn);
    if (!projectId) return null;
    const repoFull = `${owner}/${repo}`;
    const entries: StatusEntry[] = [];
    let cursor: string | null = null;

    for (let guard = 0; guard < 30; guard++) {
      const data: {
        node: {
          items: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
              id: string;
              content: { number?: number; repository?: { nameWithOwner: string } } | null;
              fieldValueByName: { name?: string } | null;
            }>;
          };
        } | null;
      } = await gql(
        `query($projectId: ID!, $cursor: String) {
          node(id: $projectId) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                  id
                  content { ... on Issue { number repository { nameWithOwner } } }
                  fieldValueByName(name: "Status") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
                }
              }
            }
          }
        }`,
        { projectId, cursor },
      );
      const items = data.node?.items;
      if (!items) break;
      for (const node of items.nodes) {
        if (
          node.content?.repository?.nameWithOwner === repoFull &&
          node.content.number !== undefined &&
          node.fieldValueByName?.name
        ) {
          entries.push({
            key: `github:${repoFull}#${node.content.number}`,
            status: node.fieldValueByName.name,
            projectItemId: node.id,
          });
        }
      }
      if (!items.pageInfo.hasNextPage) break;
      cursor = items.pageInfo.endCursor;
    }
    return entries;
  },

  async getColumns(conn): Promise<Column[]> {
    const { projectNumber, labelColumns } = cfg(conn);
    if (projectNumber) {
      const { field } = await resolveProject(conn);
      return field.options.map((o) => ({ id: o.id, name: o.name }));
    }
    return (labelColumns ?? DEFAULT_COLUMNS).map((name) => ({ id: null, name }));
  },

  deriveStatus(conn, issue): string | null {
    if (cfg(conn).projectId) return null; // project mode: the sweep is authoritative
    const columns = cfg(conn).labelColumns ?? DEFAULT_COLUMNS;
    const statusLabel = issue.labels.find((l) => l.startsWith(STATUS_PREFIX));
    if (statusLabel) {
      const slug = statusLabel.slice(STATUS_PREFIX.length);
      const match = columns.find((c) => slugOf(c) === slug);
      if (match) return match;
    }
    if (issue.state === "closed") return columns.find(isDoneColumn) ?? columns[columns.length - 1];
    return columns[0];
  },

  async pushFields(conn, task, fields): Promise<PushResult> {
    const { owner, repo } = cfg(conn);
    const number = meta(task).number;
    const body: Record<string, unknown> = {};
    if (fields.title !== undefined) body.title = fields.title;
    if (fields.body !== undefined) body.body = fields.body;
    if (fields.state !== undefined) {
      body.state = fields.state;
      body.state_reason = fields.state === "closed" ? "completed" : "reopened";
    }
    const res = await ghFetch(`/repos/${owner}/${repo}/issues/${number}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as RawIssue;
    return { remoteUpdatedAt: json.updated_at };
  },

  async setStatus(conn, task, statusName): Promise<PushResult> {
    const config = cfg(conn);
    const number = meta(task).number;
    const currentState = (meta(task).state as string) ?? "open";
    const result: PushResult = {};

    if (config.projectId && config.statusFieldId) {
      // --- project mode ---
      let columns = conn.columnsCache as unknown as Column[];
      let option = columns.find((c) => c.name.toLowerCase() === statusName.toLowerCase());
      if (!option?.id) {
        columns = await this.getColumns(conn); // column may have been renamed — refresh once
        option = columns.find((c) => c.name.toLowerCase() === statusName.toLowerCase());
      }
      if (!option?.id) throw new ProviderError(400, `Status column '${statusName}' not found on the project`);

      let projectItemId = meta(task).projectItemId as string | undefined;
      if (!projectItemId) {
        const added = await gql<{ addProjectV2ItemById: { item: { id: string } } }>(
          `mutation($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
          }`,
          { projectId: config.projectId, contentId: meta(task).nodeId },
        );
        projectItemId = added.addProjectV2ItemById.item.id;
        result.projectItemId = projectItemId;
      }

      await gql(
        `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
          updateProjectV2ItemFieldValue(input: {
            projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
            value: { singleSelectOptionId: $optionId }
          }) { projectV2Item { id } }
        }`,
        { projectId: config.projectId, itemId: projectItemId, fieldId: config.statusFieldId, optionId: option.id },
      );

      // Done column ⇒ close the issue (and reopen when leaving Done).
      if (isDoneColumn(statusName) && currentState !== "closed") {
        const push = await this.pushFields(conn, task, { state: "closed" });
        result.remoteUpdatedAt = push.remoteUpdatedAt;
      } else if (!isDoneColumn(statusName) && currentState === "closed") {
        const push = await this.pushFields(conn, task, { state: "open" });
        result.remoteUpdatedAt = push.remoteUpdatedAt;
      }
      return result;
    }

    // --- label mode ---
    const labels = ((meta(task).labels as string[]) ?? []).filter((l) => !l.startsWith(STATUS_PREFIX));
    labels.push(`${STATUS_PREFIX}${slugOf(statusName)}`);
    const body: Record<string, unknown> = { labels };
    if (isDoneColumn(statusName) && currentState !== "closed") {
      body.state = "closed";
      body.state_reason = "completed";
    } else if (!isDoneColumn(statusName) && currentState === "closed") {
      body.state = "open";
      body.state_reason = "reopened";
    }
    const { owner, repo } = config;
    const res = await ghFetch(`/repos/${owner}/${repo}/issues/${number}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as RawIssue;
    return { remoteUpdatedAt: json.updated_at };
  },

  async listComments(conn, task): Promise<RemoteComment[]> {
    const { owner, repo } = cfg(conn);
    const res = await ghFetch(`/repos/${owner}/${repo}/issues/${meta(task).number}/comments?per_page=100`);
    const json = (await res.json()) as Array<{
      id: number;
      user: { login: string } | null;
      body: string | null;
      created_at: string;
      html_url: string;
    }>;
    return json.map((c) => ({
      id: String(c.id),
      author: c.user?.login ?? "unknown",
      body: c.body ?? "",
      createdAt: c.created_at,
      url: c.html_url,
    }));
  },

  async addComment(conn, task, body): Promise<RemoteComment> {
    const { owner, repo } = cfg(conn);
    const res = await ghFetch(`/repos/${owner}/${repo}/issues/${meta(task).number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    const c = (await res.json()) as {
      id: number;
      user: { login: string } | null;
      body: string;
      created_at: string;
      html_url: string;
    };
    return {
      id: String(c.id),
      author: c.user?.login ?? "you",
      body: c.body,
      createdAt: c.created_at,
      url: c.html_url,
    };
  },
};
