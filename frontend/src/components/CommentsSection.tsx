import { useEffect, useState } from "react";
import { api, type RemoteComment } from "../data/api";
import { t, useT, dateLocale } from "../i18n";

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return t("b.comments.justNow");
  if (mins < 60) return t("b.comments.minsAgo", { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t("b.comments.hoursAgo", { n: hours });
  const days = Math.round(hours / 24);
  return days < 30 ? t("b.comments.daysAgo", { n: days }) : new Date(iso).toLocaleDateString(dateLocale());
}

// Live comment thread for a synced task — fetched from the provider, never stored.
export function CommentsSection({ taskId }: { taskId: string }) {
  const t = useT();
  const [comments, setComments] = useState<RemoteComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .listComments(taskId)
      .then(({ comments }) => !cancelled && setComments(comments))
      .catch((e) => !cancelled && setError((e as Error).message.slice(0, 200)));
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const post = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const comment = await api.addComment(taskId, body);
      setComments((prev) => [...(prev ?? []), comment]);
      setDraft("");
    } catch (e) {
      setError((e as Error).message.slice(0, 200));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <span className="block text-xs text-nc-faint mb-1.5">
        {t("b.comments.label")} {comments ? `(${comments.length})` : ""}
      </span>

      {error && <div className="text-2xs text-nc-danger mb-1.5">{t("b.comments.unreachable", { error })}</div>}
      {!error && comments === null && <div className="text-2xs text-nc-faint mb-1.5">{t("b.comments.loading")}</div>}

      {comments && comments.length > 0 && (
        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto mb-2 pr-1">
          {comments.map((c) => (
            <div key={c.id} className="rounded-nc-md bg-nc-well/60 border border-nc-line-faint px-2.5 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-2xs text-nc-accent">{c.author}</span>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-2xs text-nc-faint hover:text-nc-muted"
                >
                  {relativeTime(c.createdAt)} ↗
                </a>
              </div>
              <div className="text-xs text-nc-soft whitespace-pre-wrap break-words">{c.body}</div>
            </div>
          ))}
        </div>
      )}
      {comments && comments.length === 0 && (
        <div className="text-2xs text-nc-faint mb-2">{t("b.comments.none")}</div>
      )}

      <div className="flex gap-1.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={t("b.comments.placeholder")}
          className="flex-1 px-2.5 py-1.5 rounded-nc-md bg-nc-well/60 border border-nc-line-faint text-xs transition-colors resize-none"
        />
        <button
          type="button"
          onClick={() => void post()}
          disabled={!draft.trim() || posting}
          className="self-end px-3 py-1.5 rounded-nc-md bg-nc-select-surface/70 hover:bg-nc-select-surface disabled:opacity-60 disabled:cursor-not-allowed text-nc-text text-xs transition-colors"
        >
          {posting ? "…" : t("b.comments.post")}
        </button>
      </div>
    </div>
  );
}
