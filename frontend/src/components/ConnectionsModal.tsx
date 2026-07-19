import { useState } from "react";
import { motion } from "framer-motion";
import { useStore, type Connection } from "../store";
import { t, useT } from "../i18n";

interface ConnectionsModalProps {
  canvasId: string;
  onClose: () => void;
}

interface GithubConfig {
  owner?: string;
  repo?: string;
  projectNumber?: number;
  projectOwner?: string;
  labels?: string[];
  assignee?: string;
  placement?: string;
}

function relativeTime(iso: string | null): string {
  if (!iso) return t("a.connections.never");
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return t("a.connections.justNow");
  if (mins < 60) return t("a.connections.minAgo", { count: mins });
  const hours = Math.round(mins / 60);
  return hours < 24
    ? t("a.connections.hourAgo", { count: hours })
    : t("a.connections.dayAgo", { count: Math.round(hours / 24) });
}

const STATUS_DOT: Record<string, string> = {
  ok: "bg-emerald-400",
  syncing: "bg-cyan-400",
  error: "bg-red-500",
  idle: "bg-gray-500",
};

export function ConnectionsModal({ canvasId, onClose }: ConnectionsModalProps) {
  const tr = useT();
  const connections = useStore((s) => s.connections);
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [projectOwner, setProjectOwner] = useState("");
  const [labels, setLabels] = useState("");
  const [assignee, setAssignee] = useState("");
  const [placement, setPlacement] = useState<"inbox" | "canvas">("canvas");
  const [pollMinutes, setPollMinutes] = useState(5);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const add = async () => {
    if (!owner.trim() || !repo.trim()) {
      setFormError(tr("a.connections.ownerRepoRequired"));
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const config: Record<string, unknown> = {
        owner: owner.trim(),
        repo: repo.trim(),
        placement,
      };
      if (projectNumber.trim()) config.projectNumber = Number(projectNumber);
      if (projectOwner.trim()) config.projectOwner = projectOwner.trim();
      if (labels.trim()) config.labels = labels.split(",").map((l) => l.trim()).filter(Boolean);
      if (assignee.trim()) config.assignee = assignee.trim();

      await useStore.getState().addConnection({ provider: "github", canvasId, config, pollMinutes });
      setOwner(""); setRepo(""); setProjectNumber(""); setProjectOwner(""); setLabels(""); setAssignee("");
      useStore.getState().showToast(tr("a.connections.connected"));
    } catch (e) {
      setFormError((e as Error).message.slice(0, 300));
    } finally {
      setBusy(false);
    }
  };

  const row = (conn: Connection) => {
    const config = conn.config as GithubConfig;
    return (
      <div key={conn.id} className="flex items-center gap-2 py-2 border-b border-white/5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[conn.status] ?? "bg-gray-500"}`}
          title={conn.statusMessage ?? conn.status}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-200 truncate">
            ⑂ {config.owner}/{config.repo}
            {config.projectNumber && (
              <span className="ml-1.5 text-[10px] text-cyan-400">▦ {tr("a.connections.projectTag", { count: config.projectNumber })}</span>
            )}
            {!config.projectNumber && (
              <span className="ml-1.5 text-[10px] text-gray-500">{tr("a.connections.labelsMode")}</span>
            )}
          </div>
          <div className="text-[10px] text-gray-500 truncate">
            {conn.status === "error"
              ? conn.statusMessage
              : tr("a.connections.synced", {
                  time: relativeTime(conn.lastSyncAt),
                  count: conn.pollMinutes,
                  columns: conn.columnsCache.map((c) => c.name).join(" / ") || tr("a.connections.noColumns"),
                })}
          </div>
        </div>
        <button
          onClick={() => void useStore.getState().syncConnection(conn.id).catch(() => {})}
          className="text-[10px] text-cyan-300 hover:text-cyan-200 px-1.5 py-1 whitespace-nowrap transition-colors"
        >
          {tr("a.connections.syncNow")}
        </button>
        <button
          onClick={() =>
            void useStore.getState().patchConnection(conn.id, { enabled: !conn.enabled }).catch((e) => console.error(e))
          }
          className={`text-[10px] px-1.5 py-1 transition-colors ${
            conn.enabled ? "text-gray-400 hover:text-gray-200" : "text-amber-400"
          }`}
          title={conn.enabled ? tr("a.connections.pause") : tr("a.connections.resume")}
        >
          {conn.enabled ? "⏸" : "▶"}
        </button>
        <button
          onClick={() => {
            if (confirm(tr("a.connections.disconnect", { owner: config.owner ?? "", repo: config.repo ?? "" }))) {
              void useStore.getState().removeConnection(conn.id).catch((e) => console.error(e));
            }
          }}
          className="text-[10px] text-gray-600 hover:text-red-400 px-1 transition-colors"
        >
          ×
        </button>
      </div>
    );
  };

  const inputClass =
    "px-2.5 py-1.5 rounded-lg bg-[#0f0f13]/60 border border-white/10 focus:border-purple-500 text-xs outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="relative w-full max-w-lg rounded-xl bg-[#1a1d24]/97 backdrop-blur-xl border border-white/15 shadow-2xl p-5 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-100">{tr("a.connections.title")}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">×</button>
        </div>

        {connections.length > 0 ? (
          <div className="mb-4">{connections.map(row)}</div>
        ) : (
          <div className="mb-4 text-xs text-gray-500">
            {tr("a.connections.empty")}
          </div>
        )}

        <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">{tr("a.connections.addRepo")}</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder={tr("a.connections.ph.owner")} className={inputClass} />
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder={tr("a.connections.ph.repo")} className={inputClass} />
          <input value={projectNumber} onChange={(e) => setProjectNumber(e.target.value.replace(/\D/g, ""))} placeholder={tr("a.connections.ph.projectNumber")} className={inputClass} />
          <input value={projectOwner} onChange={(e) => setProjectOwner(e.target.value)} placeholder={tr("a.connections.ph.projectOwner")} className={inputClass} />
          <input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder={tr("a.connections.ph.labels")} className={inputClass} />
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder={tr("a.connections.ph.assignee")} className={inputClass} />
          <select value={placement} onChange={(e) => setPlacement(e.target.value as "inbox" | "canvas")} className={inputClass}>
            <option value="canvas">{tr("a.connections.place.canvas")}</option>
            <option value="inbox">{tr("a.connections.place.inbox")}</option>
          </select>
          <select value={pollMinutes} onChange={(e) => setPollMinutes(Number(e.target.value))} className={inputClass}>
            {[2, 5, 10, 30, 60].map((m) => (
              <option key={m} value={m}>{tr("a.connections.poll", { count: m })}</option>
            ))}
          </select>
        </div>
        {formError && <div className="text-[10px] text-red-400 mb-2 whitespace-pre-wrap">{formError}</div>}
        <button
          onClick={() => void add()}
          disabled={busy}
          className="w-full py-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-medium transition-colors"
        >
          {busy ? tr("a.connections.validating") : tr("a.connections.connect")}
        </button>

        <p className="mt-3 text-[10px] text-gray-600 leading-relaxed">
          {tr("a.connections.help1")}<code>GITHUB_TOKEN</code>{tr("a.connections.help2")}<code>server/.env</code>{tr("a.connections.help3")}<code>status:&lt;column&gt;</code>{tr("a.connections.help4")}<em>{tr("a.connections.helpArchiving")}</em>{tr("a.connections.help5")}
        </p>
      </motion.div>
    </div>
  );
}
