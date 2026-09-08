import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FormFeedback } from "../../auth/components/FormFeedback";
import { useAuth } from "../../auth/hooks/useAuth";
import { Pagination } from "../../../components/shared/Pagination/Pagination";
import { useGetTimeEntriesQuery } from "../../tasks/api/tasksApi";
import {
  useCreateCorrectionMutation,
  useCreateReportMutation,
  useDeleteDraftReportMutation,
  useGetCandidatesQuery,
  useGetReportQuery,
  useGetReportsQuery,
  useGetVersionQuery,
  useGetVersionsQuery,
  useImportTasksMutation,
  useReviewReportMutation,
  useSaveReportMutation,
  useSubmitReportMutation,
} from "../api/reportsApi";
import type {
  Achievement,
  Blocker,
  ReportDto,
  ReportTask,
  ReportVersion,
  TaskCandidate,
  TaskSection,
} from "../types/report.types";
import {
  editableReportSchema,
  reportWeekSchema,
} from "../schemas/report.schemas";

const monday = (offset = 0) => {
  const date = new Date();
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return date.toISOString().slice(0, 10);
};
const formatDuration = (minutes: number | null) => {
  if (minutes === null) return "—";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};
function KeyItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-950">
      ⚑ {children}
    </span>
  );
}
function ReadOnlyReportTask({
  task,
  section,
  memberId,
}: {
  task: ReportTask;
  section: TaskSection;
  memberId: string;
}) {
  const { user, hasPermission } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const canReadMemberEntries =
    user?.id === memberId || hasPermission("time:read_team");
  const scope = user?.id === memberId ? "own" : "team";
  const {
    data: entries,
    isFetching,
    isError,
  } = useGetTimeEntriesQuery(
    {
      page: 1,
      pageSize: 100,
      scope,
      memberId: scope === "team" ? memberId : undefined,
      taskId: task.sourceTaskId ?? undefined,
    },
    { skip: !expanded || !task.sourceTaskId || !canReadMemberEntries },
  );
  const timeEntries = entries?.data.data ?? [];
  return (
    <div className="rounded border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <strong>{task.name}</strong>
          <p className="mt-1 text-slate-600">
            {task.projectNameSnapshot ?? "No project"} · Priority:{" "}
            {task.priority} · Type: {task.taskType}
            {task.status ? ` · Status: ${task.status}` : ""}
          </p>
          <p className="mt-1 text-slate-600">
            Planned: {formatDuration(task.plannedMinutes)} · Actual:{" "}
            {formatDuration(task.actualMinutes)}
            {section === "THIS_WEEK"
              ? ` · Progress: ${task.actualCompletionPct ?? 0}%`
              : ` · Planned progress: ${task.plannedCompletionPct ?? 0}%`}
          </p>
          {task.sourceTaskDescription && (
            <p className="mt-1 text-slate-600">
              Description: {task.sourceTaskDescription}
            </p>
          )}
          {(task.sourceTaskPlannedDate ||
            task.sourceTaskDueDate ||
            task.sourceTaskAssigneeName) && (
            <p className="mt-1 text-slate-600">
              {task.sourceTaskPlannedDate
                ? `Start: ${task.sourceTaskPlannedDate}`
                : ""}
              {task.sourceTaskDueDate
                ? ` · Due: ${task.sourceTaskDueDate}`
                : ""}
              {task.sourceTaskAssigneeName
                ? ` · Assignee: ${task.sourceTaskAssigneeName}`
                : ""}
            </p>
          )}
          {task.deliverable && (
            <p className="mt-1 text-slate-600">
              Deliverable: {task.deliverable}
            </p>
          )}
        </div>
        {task.sourceTaskId && canReadMemberEntries && (
          <button
            type="button"
            className="text-sm text-blue-700 underline"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Hide time entries" : "Show time entries"}
          </button>
        )}
      </div>
      {expanded && task.sourceTaskId && canReadMemberEntries && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <h5 className="font-medium">Time entries</h5>
          {isFetching ? (
            <p className="mt-1 text-slate-500">Loading time entries…</p>
          ) : isError ? (
            <p className="mt-1 text-red-700">Could not load time entries.</p>
          ) : timeEntries.length ? (
            <ul className="mt-2 space-y-1 text-slate-600">
              {timeEntries.map((entry) => (
                <li key={entry.id}>
                  {entry.workDate} · {formatDuration(entry.minutes)}
                  {entry.note ? ` — ${entry.note}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-slate-500">
              No time entries were logged for this task.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-slate-950/20 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-md bg-white p-5 shadow-lg">
        <div className="mb-4 flex justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={close}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function VersionCompare({
  reportId,
  versions,
}: {
  reportId: string;
  versions: Pick<ReportVersion, "id" | "versionNumber">[];
}) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const { data: a } = useGetVersionQuery(
    { id: reportId, versionId: left },
    { skip: !left },
  );
  const { data: b } = useGetVersionQuery(
    { id: reportId, versionId: right },
    { skip: !right },
  );
  const render = (version?: ReportVersion) =>
    version ? (
      <div className="space-y-4 text-sm">
        <p>
          <strong>Version {version.versionNumber}</strong>{" "}
          {version.review?.comment && (
            <span className="text-amber-700">
              — reviewer: {version.review.comment}
            </span>
          )}
        </p>
        <p className="whitespace-pre-wrap">{version.notes || "No notes."}</p>
        <div>
          <strong>Tasks</strong>
          {version.tasks.length ? (
            <ul className="mt-1 list-disc pl-5">
              {version.tasks.map((task) => (
                <li key={task.id ?? `${task.name}-${task.displayOrder}`}>
                  {task.name} · {task.section.replace("_", " ").toLowerCase()} ·{" "}
                  {task.actualCompletionPct ?? "—"}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-slate-500">No tasks</p>
          )}
        </div>
        <div>
          <strong>Blockers</strong>
          {version.blockers.length ? (
            <ul className="mt-1 list-disc pl-5">
              {version.blockers.map((item) => (
                <li key={item.id ?? item.description}>{item.description}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-slate-500">No blockers</p>
          )}
        </div>
      </div>
    ) : (
      <p className="text-sm text-slate-500">Choose a version.</p>
    );
  return (
    <section className="mt-7 border-t border-slate-200 pt-5">
      <h3 className="font-semibold">Compare versions</h3>
      <p className="mt-1 text-sm text-slate-600">
        Compare the rejected version with your correction before you submit.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="form-label">
          Earlier version
          <select
            className="form-input mt-1 px-3"
            value={left}
            onChange={(e) => setLeft(e.target.value)}
          >
            <option value="">Select version</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                Version {version.versionNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Later version
          <select
            className="form-input mt-1 px-3"
            value={right}
            onChange={(e) => setRight(e.target.value)}
          >
            <option value="">Select version</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                Version {version.versionNumber}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-slate-200 p-4">
          {render(a?.data)}
        </div>
        <div className="rounded border border-slate-200 p-4">
          {render(b?.data)}
        </div>
      </div>
    </section>
  );
}
function VersionSnapshot({ version }: { version?: ReportVersion }) {
  if (!version)
    return <p className="text-sm text-slate-500">Choose a version.</p>;
  return (
    <article className="space-y-5 text-sm">
      <header>
        <h3 className="text-lg font-semibold">
          Version {version.versionNumber}
        </h3>
        <p className="mt-1 text-slate-600">
          {version.submittedAt
            ? `Submitted ${new Date(version.submittedAt).toLocaleString()}`
            : "Current draft"}
        </p>
        {version.review?.comment && (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-950">
            Reviewer feedback: {version.review.comment}
          </p>
        )}
      </header>
      {(["THIS_WEEK", "NEXT_WEEK"] as TaskSection[]).map((section) => {
        const tasks = version.tasks.filter((task) => task.section === section);
        return (
          <section key={section}>
            <h4 className="font-semibold">
              {section === "THIS_WEEK"
                ? "This week's work"
                : "Next week's plan"}
            </h4>
            {tasks.length ? (
              <div className="mt-2 space-y-2">
                {tasks.map((task) => (
                  <div
                    className="rounded border border-slate-200 p-3"
                    key={task.id ?? `${task.name}-${task.displayOrder}`}
                  >
                    <strong>{task.name}</strong>
                    <p className="mt-1 text-slate-600">
                      {task.projectNameSnapshot ?? "No project"} · Priority:{" "}
                      {task.priority} · Type: {task.taskType}
                      {task.status ? ` · Status: ${task.status}` : ""}
                    </p>
                    <p className="mt-1 text-slate-600">
                      Planned: {formatDuration(task.plannedMinutes)} · Actual:{" "}
                      {formatDuration(task.actualMinutes)} ·{" "}
                      {section === "THIS_WEEK"
                        ? `Progress: ${task.actualCompletionPct ?? 0}%`
                        : `Planned progress: ${task.plannedCompletionPct ?? 0}%`}
                    </p>
                    {task.deliverable && (
                      <p className="mt-1 text-slate-600">
                        Deliverable: {task.deliverable}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-slate-500">No tasks recorded.</p>
            )}
          </section>
        );
      })}
      <section>
        <h4 className="font-semibold">Blockers</h4>
        {version.blockers.length ? (
          <ul className="mt-2 space-y-1">
            {version.blockers.map((item) => (
              <li key={item.id ?? item.description}>
                {item.isKey ? (
                  <KeyItem>{item.description}</KeyItem>
                ) : (
                  item.description
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-slate-500">No blockers recorded.</p>
        )}
      </section>
      <section>
        <h4 className="font-semibold">Achievements</h4>
        {version.achievements.length ? (
          <ul className="mt-2 space-y-1">
            {version.achievements.map((item) => (
              <li key={item.id ?? item.description}>
                {item.isKey ? (
                  <KeyItem>{item.description}</KeyItem>
                ) : (
                  item.description
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-slate-500">No achievements recorded.</p>
        )}
      </section>
      <section>
        <h4 className="font-semibold">Notes</h4>
        <p className="mt-1 whitespace-pre-wrap text-slate-600">
          {version.notes || "No notes."}
        </p>
      </section>
    </article>
  );
}
const CURRENT_DRAFT = "__CURRENT_DRAFT__";

function FullScreenVersionCompare({
  reportId,
  versions,
  currentDraft,
  currentEditor,
}: {
  reportId: string;
  versions: Pick<ReportVersion, "id" | "versionNumber" | "submittedAt">[];
  currentDraft?: ReportVersion | null;
  currentEditor?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const { data: leftResult } = useGetVersionQuery(
    { id: reportId, versionId: left },
    { skip: !left },
  );
  const { data: rightResult } = useGetVersionQuery(
    { id: reportId, versionId: right },
    { skip: !right || right === CURRENT_DRAFT },
  );
  const rightVersion =
    right === CURRENT_DRAFT ? (currentDraft ?? undefined) : rightResult?.data;
  return (
    <>
      <button
        type="button"
        className="mt-6 text-sm text-blue-700 underline"
        onClick={() => setOpen(true)}
      >
        Compare versions
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-50"
          role="dialog"
          aria-modal="true"
          aria-label="Compare report versions"
        >
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold">Compare report versions</h2>
              <p className="text-sm text-slate-600">
                Review submitted versions side by side. Report editors can
                update the current draft here.
              </p>
            </div>
            <button
              type="button"
              className="button-secondary px-4"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </header>
          <div className="grid h-[calc(100vh-89px)] gap-4 overflow-auto p-5 lg:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white p-5">
              <label className="form-label">
                Submitted version
                <select
                  className="form-input mt-1 px-3"
                  value={left}
                  onChange={(event) => setLeft(event.target.value)}
                >
                  <option value="">Select a submitted version</option>
                  {versions
                    .filter((version) => version.submittedAt)
                    .map((version) => (
                      <option key={version.id} value={version.id}>
                        Version {version.versionNumber}
                      </option>
                    ))}
                </select>
              </label>
              <div className="mt-5">
                <VersionSnapshot version={leftResult?.data} />
              </div>
            </section>
            <section className="rounded border border-blue-200 bg-white p-5">
              <label className="form-label">
                Compare with
                <select
                  className="form-input mt-1 px-3"
                  value={right}
                  onChange={(event) => setRight(event.target.value)}
                >
                  <option value="">Select a version</option>
                  {currentDraft && (
                    <option value={CURRENT_DRAFT}>
                      Current draft (editable)
                    </option>
                  )}
                  {versions
                    .filter((version) => version.submittedAt)
                    .map((version) => (
                      <option key={version.id} value={version.id}>
                        Version {version.versionNumber}
                      </option>
                    ))}
                </select>
              </label>
              <div className="mt-5">
                {right === CURRENT_DRAFT ? (
                  currentEditor
                ) : (
                  <VersionSnapshot version={rightVersion} />
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function CompareDraftEditor({
  report,
  version,
  tasks,
  setTasks,
  blockers,
  setBlockers,
  achievements,
  setAchievements,
  notes,
  setNotes,
  saveDraft,
  saving,
  feedback,
  applied,
}: {
  report: ReportDto;
  version: ReportVersion;
  tasks: ReportTask[];
  setTasks: React.Dispatch<React.SetStateAction<ReportTask[]>>;
  blockers: Blocker[];
  setBlockers: React.Dispatch<React.SetStateAction<Blocker[]>>;
  achievements: Achievement[];
  setAchievements: React.Dispatch<React.SetStateAction<Achievement[]>>;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  saveDraft: (thenSubmit?: boolean) => void;
  saving: boolean;
  feedback: React.ReactNode;
  applied: () => void;
}) {
  const setKey = <T extends Blocker | Achievement>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    index: number,
  ) =>
    setter((items) =>
      items.map((item, i) => ({ ...item, isKey: i === index })),
    );
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="text-lg font-semibold">
          Current draft — Version {version.versionNumber}
        </h3>
        <p className="mt-1 text-slate-600">
          Add or remove report tasks without leaving the comparison.
        </p>
      </div>
      <div className="grid gap-3">
        <CandidateList report={report} version={version} section="THIS_WEEK" applied={applied} />
        <CandidateList report={report} version={version} section="NEXT_WEEK" applied={applied} />
      </div>
      <section>
        <h4 className="font-semibold">Added report tasks</h4>
        <div className="mt-2 space-y-2">
          {tasks.length ? tasks.map((task, index) => (
            <div className="flex items-start justify-between gap-3 rounded border border-slate-200 p-3" key={task.id ?? `draft-task-${index}`}>
              <div><strong>{task.name}</strong><p className="mt-1 text-slate-600">{task.projectNameSnapshot ?? "No project"} · {task.section === "THIS_WEEK" ? "This week's work" : "Next week's plan"}</p><p className="mt-1 text-slate-600">Priority: {task.priority} · Type: {task.taskType}{task.status ? ` · Status: ${task.status}` : ""}</p></div>
              <button type="button" className="text-red-700" onClick={() => setTasks((items) => items.filter((_, i) => i !== index))}>Remove task</button>
            </div>
          )) : <p className="text-slate-500">No tasks added.</p>}
        </div>
      </section>
      <section className="rounded border border-slate-200 p-3">
        <h4 className="font-semibold">Blockers</h4>
        {blockers.map((item, index) => (
          <div className="mt-2 flex gap-2" key={item.id ?? index}>
            <input
              className="form-input min-w-0 flex-1 px-2"
              value={item.description}
              placeholder="Describe a blocker"
              onChange={(event) =>
                setBlockers((items) =>
                  items.map((current, i) =>
                    i === index
                      ? { ...current, description: event.target.value }
                      : current,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-blue-700"
              onClick={() => setKey(setBlockers, index)}
            >
              {item.isKey ? "Flagged" : "Flag"}
            </button>
            <button
              type="button"
              className="text-red-700"
              onClick={() =>
                setBlockers((items) => items.filter((_, i) => i !== index))
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-3 text-blue-700 underline"
          onClick={() =>
            setBlockers((items) => [
              ...items,
              {
                description: "",
                isKey: false,
                status: "OPEN",
                displayOrder: items.length,
              },
            ])
          }
        >
          Add blocker
        </button>
      </section>
      <section className="rounded border border-slate-200 p-3">
        <h4 className="font-semibold">Achievements</h4>
        {achievements.map((item, index) => (
          <div className="mt-2 flex gap-2" key={item.id ?? index}>
            <input
              className="form-input min-w-0 flex-1 px-2"
              value={item.description}
              placeholder="Describe an achievement"
              onChange={(event) =>
                setAchievements((items) =>
                  items.map((current, i) =>
                    i === index
                      ? { ...current, description: event.target.value }
                      : current,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-blue-700"
              onClick={() => setKey(setAchievements, index)}
            >
              {item.isKey ? "Flagged" : "Flag"}
            </button>
            <button
              type="button"
              className="text-red-700"
              onClick={() =>
                setAchievements((items) => items.filter((_, i) => i !== index))
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="mt-3 text-blue-700 underline"
          onClick={() =>
            setAchievements((items) => [
              ...items,
              { description: "", isKey: false, displayOrder: items.length },
            ])
          }
        >
          Add achievement
        </button>
      </section>
      <label className="form-label block">
        Notes
        <textarea
          className="form-input mt-1 min-h-24 px-3 py-2"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      {feedback}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          className="button-secondary px-4"
          disabled={saving}
          onClick={() => saveDraft(false)}
        >
          Save draft
        </button>
        <button
          className="button-primary px-4"
          disabled={saving}
          onClick={() => saveDraft(true)}
        >
          Save and submit
        </button>
      </div>
    </div>
  );
}
function CandidateList({
  report,
  version,
  section,
  applied,
}: {
  report: ReportDto;
  version: ReportVersion;
  section: TaskSection;
  applied: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = useGetCandidatesQuery({
    id: report.id,
    section,
    page: 1,
    pageSize: showAll ? 100 : 5,
  });
  const [importTasks, state] = useImportTasksMutation();
  const candidates = data?.data.data ?? [];
  const add = (candidate: TaskCandidate) =>
    void importTasks({
      id: report.id,
      versionId: version.id,
      lockVersion: version.lockVersion,
      section,
      taskIds: [candidate.sourceTaskId],
    })
      .unwrap()
      .then(() => {
        applied();
      })
      .catch(() => undefined);
  return (
    <section className="rounded border border-slate-200 p-4">
      <h4 className="font-semibold">
        {section === "THIS_WEEK" ? "This Week’s Work" : "Next Week’s Plan"}
      </h4>
      <p className="mt-1 text-sm text-slate-600">
        Tasks assigned to you that overlap this reporting period.
      </p>
      {isLoading && <p className="text-sm text-slate-500">Loading tasks…</p>}
      {!isLoading && candidates.length === 0 && (
        <p className="rounded border border-slate-200 p-4 text-sm text-slate-600">
          No assigned tasks overlap this reporting week.{" "}
          <Link to="/tasks" className="text-blue-700 underline">
            Create a task
          </Link>
          .
        </p>
      )}
      <div className="space-y-2">
        {candidates.map((candidate) => (
          <div
            key={candidate.sourceTaskId}
            className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm"
          >
            <span>
              <strong>{candidate.name}</strong>
              <span className="block text-slate-500">
                {candidate.project.name}
              </span>
            </span>
            <button
              disabled={candidate.alreadyImported || state.isLoading}
              className="button-secondary px-3"
              onClick={() => add(candidate)}
            >
              {candidate.alreadyImported ? "Added" : "Add"}
            </button>
          </div>
        ))}
      </div>
      {!isLoading && !showAll && (data?.data.pagination.total ?? 0) > 5 && (
        <button
          type="button"
          className="mt-3 text-sm text-blue-700 underline"
          onClick={() => setShowAll(true)}
        >
          More qualified tasks ({data!.data.pagination.total - 5})
        </button>
      )}
      {state.isError && (
        <div className="mt-3">
          <FormFeedback>Could not add the selected task.</FormFeedback>
        </div>
      )}
    </section>
  );
}
function RequestChangesDialog({
  reportId,
  versionId,
  close,
}: {
  reportId: string;
  versionId: string;
  close: () => void;
}) {
  const [comment, setComment] = useState("");
  const [review, state] = useReviewReportMutation();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!comment.trim()) return;
    void review({
      id: reportId,
      versionId,
      decision: "CHANGES_REQUESTED",
      comment: comment.trim(),
    })
      .unwrap()
      .then(close)
      .catch(() => undefined);
  };
  return (
    <Dialog title="Request report changes" close={close}>
      <form className="grid gap-4" onSubmit={submit}>
        <p className="text-sm text-slate-600">
          Explain what the member needs to correct. This feedback will be shown
          with their correction draft.
        </p>
        <label className="form-label">
          Feedback
          <textarea
            required
            className="form-input mt-1 min-h-28 px-3 py-2"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
        {state.isError && (
          <FormFeedback>
            Could not request changes. Please try again.
          </FormFeedback>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="button-secondary px-4"
            onClick={close}
          >
            Cancel
          </button>
          <button
            className="button-primary px-4"
            disabled={state.isLoading || !comment.trim()}
          >
            {state.isLoading ? "Sending…" : "Request changes"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function ReportEditor({ id, close }: { id: string; close: () => void }) {
  const { user, hasPermission } = useAuth();
  const { data, isLoading, isError, refetch } = useGetReportQuery(id);
  const { data: versions, refetch: refetchVersions } = useGetVersionsQuery({ id });
  const [save, saveState] = useSaveReportMutation();
  const [submit, submitState] = useSubmitReportMutation();
  const [createCorrection, correctionState] = useCreateCorrectionMutation();
  const [draft, setDraft] = useState<ReportVersion | null>(null);
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState<ReportTask[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  useEffect(() => {
    const content = data?.data.content;
    if (content) {
      const timer = window.setTimeout(() => {
        setDraft(content);
        setNotes(content.notes ?? "");
        setTasks(content.tasks);
        setBlockers(content.blockers);
        setAchievements(content.achievements);
      });
      return () => window.clearTimeout(timer);
    }
  }, [data]);
  if (isLoading)
    return (
      <Dialog title="Report" close={close}>
        <p>Loading report…</p>
      </Dialog>
    );
  if (isError || !data)
    return (
      <Dialog title="Report" close={close}>
        <FormFeedback>
          Could not load this report.{" "}
          <button className="underline" onClick={() => void refetch()}>
            Try again
          </button>
        </FormFeedback>
      </Dialog>
    );
  const report = data.data;
  const editable =
    report.member.id === user?.id &&
    hasPermission("report:update_own") &&
    (report.status === "DRAFT" || report.status === "NEEDS_CORRECTION");
  const editableDraft = draft && !draft.submittedAt ? draft : null;
  const totalActualMinutes = tasks.reduce(
    (total, task) => total + (task.actualMinutes ?? 0),
    0,
  );
  const thisWeekTasks = tasks.filter((task) => task.section === "THIS_WEEK");
  const nextWeekTasks = tasks.filter((task) => task.section === "NEXT_WEEK");
  const groupedTasks = [...thisWeekTasks, ...nextWeekTasks];
  const apply = () => {
    void refetch();
    void refetchVersions();
  };
  const reindex = (items: ReportTask[]) =>
    items.map((task, index) => ({ ...task, displayOrder: index }));
  const setKey = <T extends Blocker | Achievement>(
    setItems: React.Dispatch<React.SetStateAction<T[]>>,
    index: number,
  ) =>
    setItems((items) =>
      items.map((item, i) => ({ ...item, isKey: i === index })),
    );
  const saveDraft = (thenSubmit = false) => {
    if (!editableDraft) return;
    const sanitizedTasks = reindex(tasks).map((task) => {
      const sanitized = { ...task };
      delete sanitized.projectNameSnapshot;
      return sanitized;
    });
    const payload = {
      id: report.id,
      versionId: editableDraft.id,
      lockVersion: editableDraft.lockVersion,
      notes: notes || null,
      tasks: sanitizedTasks,
      blockers: blockers.map((item, index) => ({
        ...item,
        displayOrder: index,
      })),
      achievements: achievements.map((item, index) => ({
        ...item,
        displayOrder: index,
      })),
    };
    const validation = editableReportSchema.safeParse(payload);
    if (!validation.success) {
      setValidationError(
        validation.error.issues[0]?.message ??
          "Please correct the report fields.",
      );
      return;
    }
    setValidationError(null);
    void save({ id: report.id, ...validation.data })
      .unwrap()
      .then((result) => {
        setDraft(result.data);
        if (thenSubmit)
          return submit({
            id: report.id,
            versionId: result.data.id,
            lockVersion: result.data.lockVersion,
          })
            .unwrap()
            .then(() => {
              void refetch();
              void refetchVersions();
            });
        return undefined;
      })
      .catch(() => undefined);
  };
  return (
    <Dialog title={`Weekly report — ${report.weekStart}`} close={close}>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded bg-slate-100 px-2 py-1">
          {report.status.replace("_", " ")}
        </span>
        <span className="rounded bg-slate-100 px-2 py-1">
          Due {new Date(report.deadlineAt).toLocaleString()}
        </span>
      </div>
      {report.latestReview?.comment && (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <strong>Review feedback:</strong> {report.latestReview.comment}
        </div>
      )}
      {!editable && (
        <section className="space-y-5 rounded border border-slate-200 p-5 text-sm">
          {report.content ? (
            <>
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">
                  Submitted report — Version {report.content.versionNumber}
                </h3>
                <strong>
                  Total actual time:{" "}
                  {formatDuration(
                    report.content.tasks.reduce(
                      (total, task) => total + (task.actualMinutes ?? 0),
                      0,
                    ),
                  )}
                </strong>
              </div>
              {(["THIS_WEEK", "NEXT_WEEK"] as TaskSection[]).map((section) => {
                const sectionTasks = report.content!.tasks.filter(
                  (task) => task.section === section,
                );
                return (
                  <div key={section}>
                    <h4 className="mb-2 font-semibold">
                      {section === "THIS_WEEK"
                        ? "This Week’s Work"
                        : "Next Week’s Tasks"}
                    </h4>
                    {sectionTasks.length ? (
                      <div className="space-y-2">
                        {sectionTasks.map((task) => (
                          <div className="contents" key={task.id}>
                            <ReadOnlyReportTask
                              task={task}
                              section={section}
                              memberId={report.member.id}
                            />
                            <div className="hidden">
                              <strong>{task.name}</strong>
                              <p className="mt-1 text-slate-600">
                                {task.projectNameSnapshot ?? "No project"} ·
                                Priority: {task.priority} · Type:{" "}
                                {task.taskType}
                                {task.status ? ` · Status: ${task.status}` : ""}
                              </p>
                              <p className="mt-1 text-slate-600">
                                Planned: {formatDuration(task.plannedMinutes)} ·
                                Actual: {formatDuration(task.actualMinutes)}
                                {section === "THIS_WEEK"
                                  ? ` · Progress: ${task.actualCompletionPct ?? 0}%`
                                  : ` · Planned progress: ${task.plannedCompletionPct ?? 0}%`}
                              </p>
                              {task.deliverable && (
                                <p className="mt-1 text-slate-600">
                                  Deliverable: {task.deliverable}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500">No tasks recorded.</p>
                    )}
                  </div>
                );
              })}
              <div>
                <h4 className="font-semibold">Blockers</h4>
                {report.content.blockers.length ? (
                  <ul className="mt-1 list-disc pl-5">
                    {report.content.blockers.map((item) => (
                      <li key={item.id}>
                        {item.isKey ? (
                          <KeyItem>{item.description}</KeyItem>
                        ) : (
                          item.description
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-500">No blockers recorded.</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold">Achievements</h4>
                {report.content.achievements.length ? (
                  <ul className="mt-1 list-disc pl-5">
                    {report.content.achievements.map((item) => (
                      <li key={item.id}>
                        {item.isKey ? (
                          <KeyItem>{item.description}</KeyItem>
                        ) : (
                          item.description
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-500">
                    No achievements recorded.
                  </p>
                )}
              </div>
              <div>
                <h4 className="font-semibold">Notes</h4>
                <p className="mt-1 whitespace-pre-wrap text-slate-600">
                  {report.content.notes || "No notes."}
                </p>
              </div>
            </>
          ) : (
            <p className="text-slate-600">
              No submitted report content is available.
            </p>
          )}
        </section>
      )}
      {editable && !editableDraft && (
        <div className="rounded border border-slate-200 p-4 text-sm">
          Create a correction version to continue editing.{" "}
          <button
            disabled={correctionState.isLoading}
            className="ml-2 text-blue-700 underline"
            onClick={() =>
              void createCorrection(report.id)
                .unwrap()
                .then(() => {
                  void refetch();
                  void refetchVersions();
                })
                .catch(() => undefined)
            }
          >
            Create correction
          </button>
        </div>
      )}
      {editable && editableDraft && (
        <div id="current-edition">
          <div className="mb-4">
            <p className="text-sm text-slate-600">
              Editing version {editableDraft.versionNumber}
            </p>
          </div>
          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <CandidateList
              report={report}
              version={editableDraft}
              section="THIS_WEEK"
              applied={apply}
            />
            <CandidateList
              report={report}
              version={editableDraft}
              section="NEXT_WEEK"
              applied={apply}
            />
          </div>
          <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span>Added report tasks</span>
            <strong>
              Total actual time: {formatDuration(totalActualMinutes)}
            </strong>
          </div>
          <div className="space-y-3">
            {groupedTasks.map((task, index) => (
              <div
                key={task.id ?? `new-${index}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded border border-slate-200 p-4 text-sm"
              >
                {(index === 0 ||
                  task.section !== groupedTasks[index - 1].section) && (
                  <h4 className="w-full border-b border-slate-200 pb-2 font-semibold text-slate-900">
                    {task.section === "THIS_WEEK"
                      ? "This Week’s Work"
                      : "Next Week’s Tasks"}
                  </h4>
                )}
                <div>
                  <strong>{task.name}</strong>
                  <p className="mt-1 text-slate-600">
                    {task.projectNameSnapshot ?? "No project"} ·{" "}
                    {task.section === "THIS_WEEK"
                      ? "This week’s work"
                      : "Next week’s plan"}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Priority: {task.priority} · Type: {task.taskType}
                    {task.status ? ` · Status: ${task.status}` : ""}
                  </p>
                  <p className="mt-1 text-slate-600">
                    Planned: {formatDuration(task.plannedMinutes)} · Actual:{" "}
                    {formatDuration(task.actualMinutes)}
                    {task.section === "THIS_WEEK"
                      ? ` · Progress: ${task.actualCompletionPct ?? 0}%`
                      : ` · Planned progress: ${task.plannedCompletionPct ?? 0}%`}
                  </p>
                  {task.deliverable && (
                    <p className="mt-1 text-slate-600">
                      Deliverable: {task.deliverable}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-red-700"
                  onClick={() =>
                    setTasks((items) => items.filter((item) => item !== task))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <section className="mt-5 rounded border border-slate-200 p-4">
            <h4 className="font-semibold">Blockers</h4>
            {blockers.map((item, index) => (
              <div className="mt-2 flex gap-2" key={item.id ?? index}>
                <input
                  className="form-input min-w-0 flex-1 px-2"
                  value={item.description}
                  placeholder="Describe a blocker"
                  onChange={(e) =>
                    setBlockers((items) =>
                      items.map((current, i) =>
                        i === index
                          ? { ...current, description: e.target.value }
                          : current,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="text-blue-700"
                  onClick={() => setKey(setBlockers, index)}
                >
                  {item.isKey ? "Flagged" : "Flag"}
                </button>
                <button
                  type="button"
                  className="text-red-700"
                  onClick={() =>
                    setBlockers((items) => items.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-3 text-sm text-blue-700 underline"
              onClick={() =>
                setBlockers((items) => [
                  ...items,
                  {
                    description: "",
                    isKey: false,
                    status: "OPEN",
                    displayOrder: items.length,
                  },
                ])
              }
            >
              Add blocker
            </button>
          </section>
          <section className="mt-4 rounded border border-slate-200 p-4">
            <h4 className="font-semibold">Achievements</h4>
            {achievements.map((item, index) => (
              <div className="mt-2 flex gap-2" key={item.id ?? index}>
                <input
                  className="form-input min-w-0 flex-1 px-2"
                  value={item.description}
                  placeholder="Describe an achievement"
                  onChange={(e) =>
                    setAchievements((items) =>
                      items.map((current, i) =>
                        i === index
                          ? { ...current, description: e.target.value }
                          : current,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="text-blue-700"
                  onClick={() => setKey(setAchievements, index)}
                >
                  {item.isKey ? "Flagged" : "Flag"}
                </button>
                <button
                  type="button"
                  className="text-red-700"
                  onClick={() =>
                    setAchievements((items) =>
                      items.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-3 text-sm text-blue-700 underline"
              onClick={() =>
                setAchievements((items) => [
                  ...items,
                  { description: "", isKey: false, displayOrder: items.length },
                ])
              }
            >
              Add achievement
            </button>
          </section>
          <label className="form-label mt-5 block">
            Notes
            <textarea
              className="form-input mt-1 min-h-24 px-3 py-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {(saveState.isError || submitState.isError) && (
              <FormFeedback>
                Could not save the report. Refresh it and try again.
              </FormFeedback>
            )}
            {validationError && <FormFeedback>{validationError}</FormFeedback>}
            <button
              className="button-secondary px-4"
              disabled={saveState.isLoading || submitState.isLoading}
              onClick={() => saveDraft(false)}
            >
              Save draft
            </button>
            <button
              className="button-primary px-4"
              disabled={saveState.isLoading || submitState.isLoading}
              onClick={() => saveDraft(true)}
            >
              {submitState.isLoading ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </div>
      )}
      {versions && (
        <FullScreenVersionCompare
          reportId={report.id}
          versions={versions.data.data}
          currentDraft={
            editableDraft
              ? { ...editableDraft, notes, tasks, blockers, achievements }
              : null
          }
          currentEditor={
            editableDraft ? (
              <CompareDraftEditor
                report={report}
                version={editableDraft}
                tasks={tasks}
                setTasks={setTasks}
                blockers={blockers}
                setBlockers={setBlockers}
                achievements={achievements}
                setAchievements={setAchievements}
                notes={notes}
                setNotes={setNotes}
                saveDraft={saveDraft}
                saving={saveState.isLoading || submitState.isLoading}
                applied={apply}
                feedback={
                  saveState.isError ||
                  submitState.isError ||
                  validationError ? (
                    <FormFeedback>
                      {validationError ??
                        "Could not save the report. Refresh it and try again."}
                    </FormFeedback>
                  ) : null
                }
              />
            ) : undefined
          }
        />
      )}
    </Dialog>
  );
}
export function ReportsPage() {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const team = hasPermission("report:read_team");
  const selectedMemberId = searchParams.get("memberId") ?? undefined;
  const [scope, setScope] = useState<"own" | "team">(
    selectedMemberId && team ? "team" : "own",
  );
  const [page, setPage] = useState(1);
  const [memberQuery, setMemberQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [fromWeek, setFromWeek] = useState("");
  const [toWeek, setToWeek] = useState("");
  useEffect(() => {
    if (selectedMemberId && team) {
      setScope("team");
      setPage(1);
    }
  }, [selectedMemberId, team]);
  useEffect(() => {
    if (fromWeek && toWeek && toWeek < fromWeek) setToWeek("");
  }, [fromWeek, toWeek]);
  const [selected, setSelected] = useState<string | null>(null);
  const [requestChanges, setRequestChanges] = useState<{
    reportId: string;
    versionId: string;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(monday());
  const [weekError, setWeekError] = useState<string | null>(null);
  const { data, isLoading, isFetching } = useGetReportsQuery({
    page,
    pageSize: 20,
    scope,
    ...(scope === "team" && selectedMemberId ? { memberId: selectedMemberId } : {}),
    ...(scope === "team" && memberQuery.trim()
      ? { memberQuery: memberQuery.trim() }
      : {}),
    ...(projectQuery.trim() ? { projectQuery: projectQuery.trim() } : {}),
    ...(fromWeek ? { fromWeek } : {}),
    ...(toWeek ? { toWeek } : {}),
  });
  const [create, createState] = useCreateReportMutation();
  const [deleteDraft, deleteDraftState] = useDeleteDraftReportMutation();
  const [review, reviewState] = useReviewReportMutation();
  const reports = data?.data.data ?? [];
  const visibleReports = reports.filter(
    (report) =>
      (!fromWeek || report.weekStart >= fromWeek) &&
      (!toWeek || report.weekStart <= toWeek),
  );
  const createFor = (selectedWeek: string) => {
    const validation = reportWeekSchema.safeParse(selectedWeek);
    if (!validation.success) {
      setWeekError("Choose a Monday as the reporting week start.");
      return;
    }
    if (validation.data > monday()) {
      setWeekError("Choose the current Monday or a past reporting week.");
      return;
    }
    setWeekError(null);
    void create({ weekStart: validation.data })
      .unwrap()
      .then((result) => {
        setCreateOpen(false);
        setSelected(result.data.id);
      })
      .catch(() => undefined);
  };
  const canReview = hasPermission("report:review");
  const canCreate = hasPermission("report:create");
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Weekly reports</h2>
          <p className="mt-1 text-sm text-slate-600">
            Draft, submit, and revise your weekly work report.
          </p>
        </div>
        {canCreate && (
          <button
            className="button-primary px-4"
            onClick={() => setCreateOpen(true)}
          >
            Create report
          </button>
        )}
      </div>
      {team && (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <button
              className={
                scope === "own"
                  ? "button-primary px-3"
                  : "button-secondary px-3"
              }
              onClick={() => {
                setScope("own");
                setPage(1);
              }}
            >
              My reports
            </button>
            <button
              className={
                scope === "team"
                  ? "button-primary px-3"
                  : "button-secondary px-3"
              }
              onClick={() => {
                setScope("team");
                setPage(1);
              }}
            >
              Team reports
            </button>
          </div>
        </div>
      )}
      <div className={`mb-4 grid gap-3 rounded-md border border-slate-200 bg-white p-3 ${scope === "team" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          {scope === "team" && (
              <input
                className="form-input px-3"
                aria-label="Search reports by team member"
                value={memberQuery}
                placeholder="Search member name, email or employee ID"
                onChange={(event) => {
                  setMemberQuery(event.target.value);
                  setPage(1);
                }}
              />
          )}
          <input className="form-input px-3" aria-label="Search reports by project" value={projectQuery} placeholder="Search project" onChange={(event) => { setProjectQuery(event.target.value); setPage(1); }} />
          <label className="form-label">From reporting week<select className="form-input mt-1 px-3" aria-label="Filter reports from week" value={fromWeek} onChange={(event) => { setFromWeek(event.target.value); setPage(1); }}><option value="">Any week</option>{Array.from({ length: 53 }, (_, index) => monday(-index)).map((week) => <option key={week} value={week}>{week}</option>)}</select></label>
          <label className="form-label">To reporting week <span className="font-normal text-slate-500">(optional)</span><select className="form-input mt-1 px-3" aria-label="Filter reports to week" value={toWeek} onChange={(event) => { setToWeek(event.target.value); setPage(1); }}><option value="">No end week</option>{Array.from({ length: 53 }, (_, index) => monday(-index)).map((week) => <option key={week} value={week} disabled={Boolean(fromWeek && week < fromWeek)}>{week}</option>)}</select></label>
      </div>
      {createState.isError && (
        <div className="mb-4">
          <FormFeedback>
            A report already exists for that week or could not be created.
          </FormFeedback>
        </div>
      )}
      {isLoading && <p className="text-sm text-slate-500">Loading reports…</p>}
      {visibleReports.length === 0 && !isLoading && (
        <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No reports yet. Create a report for any reporting week.
        </div>
      )}
      {visibleReports.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-175 text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3">Week</th>
                {scope === "team" && <th className="p-3">Member</th>}
                <th className="p-3">Status</th>
                <th className="p-3">Timing</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleReports.map((report) => (
                <tr key={report.id} className="border-t border-slate-100">
                  <td className="p-3">
                    {report.weekStart} – {report.weekEnd}
                  </td>
                  {scope === "team" && (
                    <td className="p-3">
                      {report.member.firstName} {report.member.lastName}
                    </td>
                  )}
                  <td className="p-3">{report.status.replace("_", " ")}</td>
                  <td className="p-3">
                    {report.submissionTiming.replace("_", " ")}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      className="text-blue-700"
                      onClick={() => setSelected(report.id)}
                    >
                      Open
                    </button>
                    {scope === "own" && report.status === "DRAFT" && (
                      <button
                        className="ml-3 text-red-700"
                        disabled={deleteDraftState.isLoading}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this unsubmitted draft? This cannot be undone.",
                            )
                          ) {
                            void deleteDraft(report.id);
                          }
                        }}
                      >
                        Delete draft
                      </button>
                    )}
                    {scope === "team" &&
                      canReview &&
                      report.status === "SUBMITTED" &&
                      report.latestSubmittedVersionId && (
                        <>
                          <button
                            className="ml-3 text-green-700"
                            disabled={reviewState.isLoading}
                            onClick={() =>
                              void review({
                                id: report.id,
                                versionId: report.latestSubmittedVersionId!,
                                decision: "APPROVED",
                              })
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="ml-3 text-amber-700"
                            disabled={reviewState.isLoading}
                            onClick={() =>
                              setRequestChanges({
                                reportId: report.id,
                                versionId: report.latestSubmittedVersionId!,
                              })
                            }
                          >
                            Request changes
                          </button>
                        </>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && (
        <Pagination
          page={page}
          totalPages={data.data.pagination.totalPages}
          hasMore={data.data.pagination.hasMore}
          onPageChange={setPage}
          disabled={isFetching}
        />
      )}
      {selected && (
        <ReportEditor id={selected} close={() => setSelected(null)} />
      )}
      {createOpen && (
        <Dialog title="Create weekly report" close={() => setCreateOpen(false)}>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createFor(weekStart);
            }}
          >
            <p className="text-sm text-slate-600">
              Select the Monday that starts the reporting week. You can create
              reports for the current or a past week.
            </p>
            <label className="form-label">
              Reporting week
              <input
                required
                type="date"
                className="form-input mt-1 px-3"
                value={weekStart}
                max={monday()}
                onChange={(event) => setWeekStart(event.target.value)}
              />
            </label>
            {(weekError || createState.isError) && (
              <FormFeedback>
                {weekError ??
                  "A report already exists for that week or it could not be created."}
              </FormFeedback>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="button-secondary px-4"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                disabled={createState.isLoading}
                className="button-primary px-4"
              >
                {createState.isLoading ? "Creating…" : "Create report"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {requestChanges && (
        <RequestChangesDialog
          reportId={requestChanges.reportId}
          versionId={requestChanges.versionId}
          close={() => setRequestChanges(null)}
        />
      )}
    </section>
  );
}
