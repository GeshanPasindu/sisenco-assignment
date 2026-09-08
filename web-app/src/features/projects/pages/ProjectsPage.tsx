import { useState } from "react";
import { FormFeedback } from "../../auth/components/FormFeedback";
import { useAuth } from "../../auth/hooks/useAuth";
import { useGetUsersQuery } from "../../user-management/api/usersApi";
import { Pagination } from "../../../components/shared/Pagination/Pagination";
import {
  useArchiveProjectMutation,
  useCreateProjectMutation,
  useGetProjectMembersQuery,
  useGetProjectsQuery,
  useSetProjectMembersMutation,
  useUpdateProjectMutation,
} from "../api/projectsApi";
import type { ProjectDto, ProjectInput } from "../types/project.types";

const empty: ProjectInput = {
  name: "",
  clientName: "",
  description: "",
  startDate: null,
  endDate: null,
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
function ProjectForm({
  initial,
  close,
}: {
  initial?: ProjectDto;
  close: () => void;
}) {
  const [form, setForm] = useState<ProjectInput>(
    initial
      ? {
          name: initial.name,
          clientName: initial.clientName ?? "",
          description: initial.description ?? "",
          startDate: initial.startDate,
          endDate: initial.endDate,
        }
      : empty,
  );
  const [create, createState] = useCreateProjectMutation();
  const [update, updateState] = useUpdateProjectMutation();
  const saving = createState.isLoading || updateState.isLoading;
  const set = (key: keyof ProjectInput, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = {
      ...form,
      clientName: nullable(form.clientName),
      description: nullable(form.description),
      startDate: nullable(form.startDate),
      endDate: nullable(form.endDate),
    };
    const request = initial
      ? update({ id: initial.id, ...body })
      : create(body);
    void request
      .unwrap()
      .then(close)
      .catch(() => undefined);
  };
  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="form-label">
        Project name
        <input
          required
          className="form-input mt-1 px-3"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      <label className="form-label">
        Client
        <input
          className="form-input mt-1 px-3"
          value={form.clientName ?? ""}
          onChange={(e) => set("clientName", e.target.value)}
        />
      </label>
      <label className="form-label">
        Description
        <textarea
          className="form-input mt-1 min-h-24 px-3 py-2"
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="form-label">
          Start date
          <input
            type="date"
            className="form-input mt-1 px-3"
            value={form.startDate ?? ""}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </label>
        <label className="form-label">
          End date
          <input
            type="date"
            className="form-input mt-1 px-3"
            value={form.endDate ?? ""}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </label>
      </div>
      {(createState.error || updateState.error) && (
        <FormFeedback>
          Could not save this project. Check the dates and try again.
        </FormFeedback>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="button-secondary px-4" onClick={close}>
          Cancel
        </button>
        <button disabled={saving} className="button-primary px-4">
          {saving ? "Saving…" : "Save project"}
        </button>
      </div>
    </form>
  );
}
function MembersDialog({
  project,
  close,
}: {
  project: ProjectDto;
  close: () => void;
}) {
  const { data: members } = useGetProjectMembersQuery(project.id);
  const { data: users } = useGetUsersQuery({
    page: 1,
    pageSize: 100,
    accountStatus: "ACTIVE",
  });
  const [save, state] = useSetProjectMembersMutation();
  const [selected, setSelected] = useState<string[] | null>(null);
  const memberIds = selected ?? members?.data.map((member) => member.id) ?? [];
  const toggle = (id: string) =>
    setSelected((ids) =>
      (ids ?? memberIds).includes(id)
        ? (ids ?? memberIds).filter((item) => item !== id)
        : [...(ids ?? memberIds), id],
    );
  return (
    <Dialog title={`Assign members — ${project.name}`} close={close}>
      <p className="mb-3 text-sm text-slate-600">
        Assigned members can see this project and receive its tasks.
      </p>
      <div className="max-h-80 space-y-2 overflow-auto rounded border border-slate-200 p-3">
        {users?.data.data.map((user) => (
          <label key={user.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={memberIds.includes(user.id)}
              onChange={() => toggle(user.id)}
            />
            {user.firstName} {user.lastName}{" "}
            <span className="text-slate-500">{user.email}</span>
          </label>
        ))}
      </div>
      {state.isError && (
        <div className="mt-3">
          <FormFeedback>Could not update project members.</FormFeedback>
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="button-secondary px-4" onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          disabled={state.isLoading}
          className="button-primary px-4"
          onClick={() =>
            void save({ id: project.id, memberIds })
              .unwrap()
              .then(close)
              .catch(() => undefined)
          }
        >
          {state.isLoading ? "Saving…" : "Save members"}
        </button>
      </div>
    </Dialog>
  );
}
export function ProjectsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("project:manage");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const [members, setMembers] = useState<ProjectDto | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isFetching, isError, refetch } = useGetProjectsQuery(
    { page, pageSize: 20, q: search || undefined },
  );
  const [archive] = useArchiveProjectMutation();
  const projects = data?.data.data ?? [];
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Projects</h2>
          <p className="mt-1 text-sm text-slate-600">
            Projects you are assigned to and the work linked to them.
          </p>
        </div>
        {canManage && (
          <button
            className="button-primary px-4"
            onClick={() => setCreating(true)}
          >
            Create project
          </button>
        )}
      </div>
      <input
        aria-label="Search projects"
        className="form-input mb-4 max-w-md px-3"
        placeholder="Search projects"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {isLoading && <p className="text-sm text-slate-500">Loading projects…</p>}
      {isError && (
        <div className="form-feedback-error p-4">
          Could not load projects.{" "}
          <button className="underline" onClick={() => void refetch()}>
            Try again
          </button>
        </div>
      )}
      {!isLoading && !isError && projects.length === 0 && (
        <p className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No projects are assigned to you yet.
        </p>
      )}
      {projects.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-175 text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3">Project</th>
                <th className="p-3">Client</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Description</th>
                {canManage && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-t border-slate-100">
                  <td className="p-3 font-medium">{project.name}</td>
                  <td className="p-3">{project.clientName ?? "—"}</td>
                  <td className="p-3 whitespace-nowrap">
                    {project.startDate ?? "—"} – {project.endDate ?? "—"}
                  </td>
                  <td className="max-w-sm truncate p-3">
                    {project.description ?? "—"}
                  </td>
                  {canManage && (
                    <td className="p-3 text-right">
                      <button
                        className="mr-3 text-blue-700"
                        onClick={() => setEditing(project)}
                      >
                        Edit
                      </button>
                      <button
                        className="mr-3 text-blue-700"
                        onClick={() => setMembers(project)}
                      >
                        Members
                      </button>
                      <button
                        className="text-red-700"
                        onClick={() => void archive(project.id)}
                      >
                        Archive
                      </button>
                    </td>
                  )}
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
      {creating && (
        <Dialog title="Create project" close={() => setCreating(false)}>
          <ProjectForm close={() => setCreating(false)} />
        </Dialog>
      )}
      {editing && (
        <Dialog title="Edit project" close={() => setEditing(null)}>
          <ProjectForm initial={editing} close={() => setEditing(null)} />
        </Dialog>
      )}
      {members && (
        <MembersDialog project={members} close={() => setMembers(null)} />
      )}
    </section>
  );
}
