import { useState } from "react";
import { FormFeedback } from "../../auth/components/FormFeedback";
import { useAuth } from "../../auth/hooks/useAuth";
import { useGetProjectsQuery } from "../../projects/api/projectsApi";
import { useGetProjectMembersQuery } from "../../projects/api/projectsApi";
import { Pagination } from "../../../components/shared/Pagination/Pagination";
import {
  useCreateTaskMutation,
  useCreateTimeEntryMutation,
  useArchiveTaskMutation,
  useDeleteTimeEntryMutation,
  useGetTasksQuery,
  useGetTimeEntriesQuery,
  useUpdateTaskMutation,
  useUpdateTimeEntryMutation,
} from "../api/tasksApi";
import type { TaskDto, TaskInput, TimeEntryDto } from "../types/task.types";

const today = () => new Date().toISOString().slice(0, 10);
const empty: TaskInput = {
  name: "",
  projectId: "",
  plannedDate: today(),
  description: "",
  dueDate: null,
  priority: "MEDIUM",
  taskType: "OTHER",
  plannedCompletionPct: 100,
  plannedMinutes: 0,
};
const nullable = (value: string | null | undefined) => value?.trim() || null;
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
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-md bg-white p-5 shadow-lg">
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
function TaskForm({ task, close }: { task?: TaskDto; close: () => void }) {
  const { hasPermission } = useAuth();
  const admin = hasPermission("task:manage_team");
  const [form, setForm] = useState<TaskInput>(
    task
      ? {
          name: task.name,
          projectId: task.project.id,
          plannedDate: task.plannedDate,
          description: task.description ?? "",
          dueDate: task.dueDate,
          priority: task.priority,
          taskType: task.taskType,
          plannedCompletionPct: task.plannedCompletionPct,
          plannedMinutes: task.plannedMinutes,
          assigneeId: task.assignee.id,
        }
      : empty,
  );
  const { data: projects } = useGetProjectsQuery({ page: 1, pageSize: 100 });
  const { data: members } = useGetProjectMembersQuery(form.projectId, {
    skip: !admin || !form.projectId,
  });
  const [create, createState] = useCreateTaskMutation();
  const [update, updateState] = useUpdateTaskMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const set = (key: keyof TaskInput, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = {
      ...form,
      description: nullable(form.description),
      dueDate: nullable(form.dueDate),
    };
    const request = task
      ? update({ ...body, id: task.id, lockVersion: task.lockVersion })
      : create(body);
    void request
      .unwrap()
      .then(close)
      .catch(() => undefined);
  };
  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="form-label">
        Task name
        <input
          required
          className="form-input mt-1 px-3"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="form-label">
          Project
          <select
            required
            className="form-input mt-1 px-3"
            value={form.projectId}
            onChange={(e) => {
              set("projectId", e.target.value);
              set("assigneeId", "");
            }}
          >
            <option value="">Select a project</option>
            {projects?.data.data.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        {admin && (
          <label className="form-label">
            Assign to
            <select
              className="form-input mt-1 px-3"
              value={form.assigneeId ?? ""}
              onChange={(e) => set("assigneeId", e.target.value)}
            >
              <option value="">Myself</option>
              {members?.data.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="form-label">
          Planned date
          <input
            required
            type="date"
            className="form-input mt-1 px-3"
            value={form.plannedDate}
            onChange={(e) => set("plannedDate", e.target.value)}
          />
        </label>
        <label className="form-label">
          Due date
          <input
            type="date"
            className="form-input mt-1 px-3"
            value={form.dueDate ?? ""}
            onChange={(e) => set("dueDate", e.target.value)}
          />
        </label>
        <label className="form-label">
          Priority
          <select
            className="form-input mt-1 px-3"
            value={form.priority}
            onChange={(e) => set("priority", e.target.value)}
          >
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Type
          <select
            className="form-input mt-1 px-3"
            value={form.taskType}
            onChange={(e) => set("taskType", e.target.value)}
          >
            {[
              "DEVELOPMENT",
              "TESTING",
              "MEETINGS",
              "DOCUMENTATION",
              "OTHER",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="form-label">
          Planned minutes
          <input
            min="0"
            type="number"
            className="form-input mt-1 px-3"
            value={form.plannedMinutes}
            onChange={(e) => set("plannedMinutes", Number(e.target.value))}
          />
        </label>
      </div>
      <label className="form-label">
        Description
        <textarea
          className="form-input mt-1 min-h-20 px-3 py-2"
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      {(createState.error || updateState.error) && (
        <FormFeedback>
          Could not save the task. Check its project assignment and details.
        </FormFeedback>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="button-secondary px-4" onClick={close}>
          Cancel
        </button>
        <button className="button-primary px-4" disabled={saving}>
          {saving ? "Saving…" : "Save task"}
        </button>
      </div>
    </form>
  );
}
function ProgressDialog({ task, close }: { task: TaskDto; close: () => void }) {
  const [status, setStatus] = useState(task.status);
  const [progress, setProgress] = useState(task.actualCompletionPct);
  const [deliverable, setDeliverable] = useState(task.deliverable ?? "");
  const [update, state] = useUpdateTaskMutation();
  return (
    <Dialog title={`Update progress — ${task.name}`} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void update({
            id: task.id,
            lockVersion: task.lockVersion,
            status,
            actualCompletionPct: progress,
            deliverable: nullable(deliverable),
          })
            .unwrap()
            .then(close)
            .catch(() => undefined);
        }}
        className="grid gap-3"
      >
        <label className="form-label">
          Status
          <select
            className="form-input mt-1 px-3"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskDto["status"])}
          >
            {["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
        <label className="form-label">
          Actual completion %
          <input
            min="0"
            max="100"
            type="number"
            className="form-input mt-1 px-3"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </label>
        <label className="form-label">
          Deliverable
          <textarea
            className="form-input mt-1 min-h-20 px-3 py-2"
            value={deliverable}
            onChange={(e) => setDeliverable(e.target.value)}
          />
        </label>
        {state.isError && (
          <FormFeedback>
            Could not update this task. It may have been changed by someone
            else.
          </FormFeedback>
        )}
        <button
          disabled={state.isLoading}
          className="button-primary justify-self-end px-4"
        >
          Save progress
        </button>
      </form>
    </Dialog>
  );
}
function TimeDialog({
  task,
  entry,
  close,
}: {
  task: TaskDto;
  entry?: TimeEntryDto;
  close: () => void;
}) {
  const [workDate, setWorkDate] = useState(entry?.workDate ?? today());
  const [minutes, setMinutes] = useState(entry?.minutes ?? 60);
  const [note, setNote] = useState(entry?.note ?? "");
  const [create, createState] = useCreateTimeEntryMutation();
  const [update, updateState] = useUpdateTimeEntryMutation();
  const saving = createState.isLoading || updateState.isLoading;
  return (
    <Dialog
      title={entry ? "Edit time entry" : `Log time — ${task.name}`}
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body = { workDate, minutes, note: nullable(note) };
          const request = entry
            ? update({ id: entry.id, ...body })
            : create({ taskId: task.id, ...body });
          void request
            .unwrap()
            .then(close)
            .catch(() => undefined);
        }}
        className="grid gap-3"
      >
        <p className="text-sm text-slate-600">
          Past and future dates are supported.
        </p>
        <label className="form-label">
          Work date
          <input
            type="date"
            required
            className="form-input mt-1 px-3"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
          />
        </label>
        <label className="form-label">
          Minutes
          <input
            type="number"
            min="1"
            max="1440"
            required
            className="form-input mt-1 px-3"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
        <label className="form-label">
          Note
          <textarea
            className="form-input mt-1 min-h-20 px-3 py-2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {(createState.error || updateState.error) && (
          <FormFeedback>
            Could not save time. A day cannot exceed 1,440 minutes.
          </FormFeedback>
        )}
        <button
          disabled={saving}
          className="button-primary justify-self-end px-4"
        >
          {saving ? "Saving…" : "Save time"}
        </button>
      </form>
    </Dialog>
  );
}
export function TasksPage() {
  const { hasPermission } = useAuth();
  const team = hasPermission("task:manage_team");
  const [scope, setScope] = useState<"own" | "team">("own");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [archive] = useArchiveTaskMutation();
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [progress, setProgress] = useState<TaskDto | null>(null);
  const [timing, setTiming] = useState<{
    task: TaskDto;
    entry?: TimeEntryDto;
  } | null>(null);
  const { data, isLoading, isFetching } = useGetTasksQuery({
    page,
    pageSize: 20,
    scope,
  });
  const { data: entries } = useGetTimeEntriesQuery({
    page: 1,
    pageSize: 100,
    scope,
  });
  const [remove] = useDeleteTimeEntryMutation();
  const tasks = data?.data.data ?? [];
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Tasks and time</h2>
          <p className="mt-1 text-sm text-slate-600">
            Plan work, track progress, and log time for any date.
          </p>
        </div>
        <button
          className="button-primary px-4"
          onClick={() => setCreateOpen(true)}
        >
          Create task
        </button>
      </div>
      {team && (
        <div className="mb-4 flex gap-2">
          <button
            className={
              scope === "own" ? "button-primary px-3" : "button-secondary px-3"
            }
            onClick={() => {
              setScope("own");
              setPage(1);
            }}
          >
            My tasks
          </button>
          <button
            className={
              scope === "team" ? "button-primary px-3" : "button-secondary px-3"
            }
            onClick={() => {
              setScope("team");
              setPage(1);
            }}
          >
            Team tasks
          </button>
        </div>
      )}
      {isLoading && <p className="text-sm text-slate-500">Loading tasks…</p>}
      {tasks.length === 0 && !isLoading && (
        <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No tasks found.{" "}
          <button
            className="text-blue-700 underline"
            onClick={() => setCreateOpen(true)}
          >
            Create a task
          </button>
          .
        </div>
      )}
      {tasks.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3">Task</th>
                <th className="p-3">Project</th>
                <th className="p-3">Assignee</th>
                <th className="p-3">Date</th>
                <th className="p-3">Progress</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <strong>{task.name}</strong>
                    <span className="block text-xs text-slate-500">
                      {task.status} · {task.loggedMinutes}m logged
                    </span>
                  </td>
                  <td className="p-3">{task.project.name}</td>
                  <td className="p-3">
                    {task.assignee.firstName} {task.assignee.lastName}
                  </td>
                  <td className="p-3">{task.plannedDate}</td>
                  <td className="p-3">{task.actualCompletionPct}%</td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <button
                      className="mr-3 text-blue-700"
                      onClick={() => setProgress(task)}
                    >
                      Progress
                    </button>
                    <button
                      className="mr-3 text-blue-700"
                      onClick={() => setTiming({ task })}
                    >
                      Log time
                    </button>
                    {(team || task.createdBy.id === task.assignee.id) && (
                      <>
                        <button
                          className="text-blue-700"
                          onClick={() => setEditing(task)}
                        >
                          Edit
                        </button>
                        {!task.archivedAt && (
                          <button
                            className="ml-3 text-red-700"
                            onClick={() => {
                              if (window.confirm(`Archive ${task.name}?`)) {
                                void archive({ id: task.id, lockVersion: task.lockVersion });
                              }
                            }}
                          >
                            Archive
                          </button>
                        )}
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
      <section className="mt-8">
        <h3 className="mb-3 text-lg font-semibold">My time entries</h3>
        {(entries?.data.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No time entries yet.</p>
        ) : (
          <div className="rounded-md border border-slate-200 bg-white">
            {entries?.data.data.map((entry) => {
              const task =
                tasks.find((item) => item.id === entry.task.id) ??
                ({ id: entry.task.id, name: entry.task.name } as TaskDto);
              return (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3 text-sm"
                >
                  <span>
                    <strong>{entry.workDate}</strong> · {entry.task.name} ·{" "}
                    {entry.minutes}m
                  </span>
                  <span>
                    <button
                      className="mr-3 text-blue-700"
                      onClick={() => setTiming({ task, entry })}
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-700"
                      onClick={() => void remove(entry.id)}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {createOpen && (
        <Dialog title="Create task" close={() => setCreateOpen(false)}>
          <TaskForm close={() => setCreateOpen(false)} />
        </Dialog>
      )}
      {editing && (
        <Dialog title="Edit task" close={() => setEditing(null)}>
          <TaskForm task={editing} close={() => setEditing(null)} />
        </Dialog>
      )}
      {progress && (
        <ProgressDialog task={progress} close={() => setProgress(null)} />
      )}
      {timing && (
        <TimeDialog
          task={timing.task}
          entry={timing.entry}
          close={() => setTiming(null)}
        />
      )}
    </section>
  );
}
