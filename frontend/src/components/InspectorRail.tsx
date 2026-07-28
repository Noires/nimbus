import type { ReactNode } from "react";
import type { Dependency, Task, Workstream } from "../store";
import { TaskInspector, WorkstreamInspector } from "./Inspector";
import type { SelectionContext } from "./selectionContext";

interface InspectorRailProps {
  context: SelectionContext;
  directory: ReactNode;
  tasks: Task[];
  workstreams: Workstream[];
  dependencies: Dependency[];
  onBack: () => void;
}

/** Shows a selected task or workstream in place of the workstreams directory. */
export function InspectorRail({
  context,
  directory,
  tasks,
  workstreams,
  dependencies,
  onBack,
}: InspectorRailProps) {
  return (
    <div data-selection-context={context.kind}>
      {context.kind === "task" ? (
        <TaskInspector
          task={context.task}
          tasks={tasks}
          workstreams={workstreams}
          dependencies={dependencies}
          onBack={onBack}
        />
      ) : context.kind === "workstream" ? (
        <WorkstreamInspector workstream={context.workstream} tasks={tasks} onBack={onBack} />
      ) : directory}
    </div>
  );
}
