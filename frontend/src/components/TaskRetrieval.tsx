import { useMemo, useState } from "react";
import type { Task } from "../data/api";
import { selectTaskRetrievalResults } from "../data/taskRetrievalSelectors";
import { useT } from "../i18n";

interface TaskRetrievalProps {
  tasks: Task[];
  onOpenInspector: (task: Task) => void;
  onReveal: (task: Task) => void;
}

export function TaskRetrieval({ tasks, onOpenInspector, onReveal }: TaskRetrievalProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => selectTaskRetrievalResults({ tasks, query }),
    [tasks, query],
  );

  const close = () => setQuery("");

  return (
    <section className="task-retrieval" aria-label={t("taskRetrieval.label")}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={t("taskRetrieval.input")}
        placeholder={t("taskRetrieval.placeholder")}
        className="task-retrieval__input"
      />
      {query.trim() && (
        <ul className="task-retrieval__results" aria-label={t("taskRetrieval.results")}>
          {results.map((task) => (
            <li key={task.id} className="task-retrieval__result">
              <button
                type="button"
                className="task-retrieval__task"
                onClick={() => {
                  close();
                  onOpenInspector(task);
                }}
              >
                {task.title}
              </button>
              <button
                type="button"
                className="task-retrieval__reveal"
                onClick={() => {
                  close();
                  onReveal(task);
                }}
              >
                {t("taskRetrieval.reveal")}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="task-retrieval__empty">{t("taskRetrieval.noMatches")}</li>}
        </ul>
      )}
    </section>
  );
}
