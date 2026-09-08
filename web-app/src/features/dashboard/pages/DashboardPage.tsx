import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FormFeedback } from "../../auth/components/FormFeedback";
import { useAuth } from "../../auth/hooks/useAuth";
import { useGetProjectsQuery } from "../../projects/api/projectsApi";
import { useGetUsersQuery } from "../../user-management/api/usersApi";
import {
  useGetMyDashboardActivityQuery,
  useGetMyDashboardQuery,
  useGetTeamDashboardActivityQuery,
  useGetTeamDashboardQuery,
} from "../api/dashboardApi";
import type { Activity, TrendPoint } from "../types/dashboard.types";

const minutes = (value: number) =>
  value >= 60 ? `${Math.floor(value / 60)}h ${value % 60}m` : `${value}m`;
const name = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`;
const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00`),
  );
const localDateOnly = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const mondayFor = (value?: string) => {
  const day = value ? new Date(`${value}T12:00:00`) : new Date();
  const dayOfWeek = day.getDay() || 7;
  day.setDate(day.getDate() - dayOfWeek + 1);
  return localDateOnly(day);
};
const isMonday = (value: string | null) =>
  value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) && mondayFor(value) === value;
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </section>
  );
}
function Chart({
  title,
  data,
  dataKey,
  unit,
}: {
  title: string;
  data: Array<Record<string, string | number>>;
  dataKey: string;
  unit?: string;
}) {
  const empty = !data.some((point) => Number(point[dataKey]) > 0);
  return (
    <section className="min-h-72 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {empty ? (
        <p className="grid h-56 place-items-center text-sm text-slate-500">
          No reported data for this period.
        </p>
      ) : (
        <>
          <div
            className="mt-4 h-56"
            role="img"
            aria-label={`${title}: ${data.map((x) => `${x.label}: ${x[dataKey]}${unit ?? ""}`).join(", ")}.`}
          >
            <ResponsiveContainer>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => `${v}${unit ?? ""}`} />
                <Bar dataKey={dataKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>
              {data.map((x) => (
                <tr key={String(x.label)}>
                  <th>{x.label}</th>
                  <td>
                    {x[dataKey]}
                    {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
function Trend({ data }: { data: TrendPoint[] }) {
  const rows = data.map((x) => ({
    label: x.weekStart.slice(5),
    completedTasks: x.completedTasks,
  }));
  return (
    <section className="min-h-72 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">Reported completed tasks</h2>
      {!rows.some((x) => x.completedTasks) ? (
        <p className="grid h-56 place-items-center text-sm text-slate-500">
          No submitted completed tasks in this range.
        </p>
      ) : (
        <div
          className="mt-4 h-56"
          role="img"
          aria-label={`Completed tasks trend: ${rows.map((x) => `${x.label}: ${x.completedTasks}`).join(", ")}.`}
        >
          <ResponsiveContainer>
            <LineChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completedTasks"
                stroke="#2563eb"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
function ReportStatusByMember({
  rows,
}: {
  rows: Array<{
    member: { firstName: string; lastName: string };
    reportState: string;
    submissionTiming: string;
  }>;
}) {
  return (
    <section className="min-h-72 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">Report status by member</h2>
      <p className="mt-1 text-sm text-slate-500">
        Current report status and submission timing for each team member.
      </p>
      {rows.length === 0 ? (
        <p className="grid h-48 place-items-center text-sm text-slate-500">
          No team reporting data for this week.
        </p>
      ) : (
        <ul className="mt-4 space-y-2" aria-label="Report status by member">
          {rows.map((row) => (
            <li
              key={name(row.member)}
              className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-800">{name(row.member)}</span>
              <span className="text-right text-slate-600">
                {row.reportState.replaceAll("_", " ")} · {row.submissionTiming.replaceAll("_", " ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function ActivityFeed({
  items,
  loading,
  error,
  more,
  onMore,
}: {
  items: Activity[];
  loading: boolean;
  error: boolean;
  more: boolean;
  onMore: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">Recent activity</h2>
      {error ? (
        <FormFeedback tone="error">
          Activity could not be loaded. Please retry.
        </FormFeedback>
      ) : loading ? (
        <p className="py-6 text-sm text-slate-500">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-sm text-slate-500">
          No report or review activity yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((item) => (
            <li className="py-3 text-sm" key={`${item.eventType}:${item.id}`}>
              <p className="font-medium text-slate-800">
                {item.eventType.replaceAll("_", " ")} · {name(item.member)}
              </p>
              <p className="mt-1 text-slate-500">
                Week of {date(item.weekStart)} · v{item.versionNumber} ·{" "}
                {new Date(item.eventAt).toLocaleString()}
              </p>
              {item.comment && (
                <p className="mt-1 text-slate-600">{item.comment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {more && (
        <button className="button-secondary mt-3 px-3" onClick={onMore}>
          Load more
        </button>
      )}
    </section>
  );
}

export function DashboardPage() {
  const { role, hasPermission } = useAuth();
  const manager =
    role?.code === "MANAGER_ADMIN" && hasPermission("dashboard:read_team");
  const member =
    role?.code === "TEAM_MEMBER" && hasPermission("dashboard:read_own");
  if (!manager && !member)
    return (
      <FormFeedback tone="error">
        You do not have access to a dashboard.
      </FormFeedback>
    );
  return manager ? <ManagerDashboard /> : <MemberDashboard />;
}
function MemberDashboard() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const dashboard = useGetMyDashboardQuery({ trendWeeks: 6 });
  const activity = useGetMyDashboardActivityQuery({ page, pageSize: 10 });
  const value = dashboard.data?.data;
  if (dashboard.isLoading)
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((x) => (
            <div className="h-28 rounded bg-slate-200" key={x} />
          ))}
        </div>
      </div>
    );
  if (dashboard.isError || !value)
    return (
      <FormFeedback tone="error">
        Your dashboard could not be loaded. Please retry.
      </FormFeedback>
    );
  const actionLabel: Record<string, string> = {
    CREATE_REPORT: "Create report",
    CONTINUE_EDITING: "Continue editing",
    MAKE_CORRECTIONS: "Make corrections",
    VIEW_REPORT: "View report",
  };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">My dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reporting week {date(value.period.weekStart)}–
          {date(value.period.weekEnd)} · Deadline{" "}
          {new Date(value.period.deadlineAt).toLocaleString()}
        </p>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-600">Current report</p>
        <p className="mt-1 text-lg font-semibold">
          {value.currentReport?.status.replaceAll("_", " ") ?? "Not started"}
        </p>
        <button
          className="button-primary mt-4 px-4"
          onClick={() => navigate("/reports")}
        >
          {actionLabel[value.primaryAction]}
        </button>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="Completed tasks"
          value={value.metrics.completedTasks}
          detail={
            value.metrics.dataSource === "EDITABLE"
              ? "From editable draft"
              : undefined
          }
        />
        <Metric
          label="Actual time"
          value={minutes(value.metrics.actualMinutes)}
          detail={
            value.metrics.dataSource === "EDITABLE"
              ? "From editable draft"
              : undefined
          }
        />
        <Metric label="Open blockers" value={value.metrics.openBlockers} />
      </div>
      <Trend data={value.tasksCompletedTrend} />
      <ActivityFeed
        items={activity.data?.data.data ?? []}
        loading={activity.isLoading}
        error={activity.isError}
        more={activity.data?.data.pagination.hasMore ?? false}
        onMore={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
function ManagerDashboard() {
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const query = useMemo(
    () => ({
      weekStart: isMonday(params.get("weekStart"))
        ? params.get("weekStart")!
        : mondayFor(params.get("weekStart") ?? undefined),
      memberId: params.get("memberId") || undefined,
      projectId: params.get("projectId") || undefined,
      trendWeeks: [4, 6, 8, 12].includes(Number(params.get("trendWeeks")))
        ? Number(params.get("trendWeeks"))
        : 6,
    }),
    [params],
  );
  const dashboard = useGetTeamDashboardQuery(query);
  const activity = useGetTeamDashboardActivityQuery({
    page,
    pageSize: 10,
    memberId: query.memberId,
  });
  const users = useGetUsersQuery({
    page: 1,
    pageSize: 100,
    roleCode: "TEAM_MEMBER",
    accountStatus: "ACTIVE",
  });
  const projects = useGetProjectsQuery({
    page: 1,
    pageSize: 100,
    archived: "false",
  });
  const value = dashboard.data?.data;
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setPage(1);
    setParams(next);
  };
  if (dashboard.isLoading)
    return <p className="text-slate-500">Loading team dashboard…</p>;
  if (dashboard.isError || !value)
    return (
      <FormFeedback tone="error">
        The team dashboard could not be loaded. Please retry.
      </FormFeedback>
    );
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">
          Team dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Reporting week {date(value.period.weekStart)}–
          {date(value.period.weekEnd)}
        </p>
      </header>
      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm">
          Week
          <input
            className="form-input mt-1 px-2"
            type="date"
            value={query.weekStart}
            onChange={(e) => set("weekStart", mondayFor(e.target.value))}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Choose any date; the dashboard automatically uses that week&apos;s Monday.
          </span>
        </label>
        <label className="text-sm">
          Member
          <select
            className="form-input mt-1 px-2"
            value={query.memberId ?? ""}
            onChange={(e) => set("memberId", e.target.value)}
          >
            <option value="">All members</option>
            {(users.data?.data.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {name(u)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Project
          <select
            className="form-input mt-1 px-2"
            value={query.projectId ?? ""}
            onChange={(e) => set("projectId", e.target.value)}
          >
            <option value="">All projects</option>
            {(projects.data?.data.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Task trend range
          <select
            className="form-input mt-1 px-2"
            value={query.trendWeeks}
            onChange={(e) => set("trendWeeks", e.target.value)}
          >
            {[4, 6, 8, 12].map((n) => (
              <option key={n} value={n}>
                Last {n} weeks
              </option>
            ))}
          </select>
        </label>
        <button
          className="button-secondary mt-5 px-3"
          onClick={() => setParams({})}
        >
          Clear filters
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Task trend range changes only the completed-tasks chart. Project filter applies only to reported-task charts.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Reports submitted"
          value={`${value.summary.submittedReports} / ${value.summary.expectedReports}`}
        />
        <Metric
          label="Submission compliance"
          value={
            value.summary.submissionRatePct === null
              ? "N/A"
              : `${value.summary.submissionRatePct}%`
          }
          detail={`On time: ${value.summary.onTime}; late: ${value.summary.late}`}
        />
        <Metric
          label="Needs correction"
          value={value.summary.needsCorrectionCount}
        />
        <Metric label="Open blockers" value={value.summary.openBlockerCount} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Trend data={value.tasksCompletedTrend} />
        <Chart
          title="Reported tasks by project"
          data={value.tasksByProject.map((x) => ({
            label: x.project.name,
            count: x.taskCount,
          }))}
          dataKey="count"
        />
        <Chart
          title="Time spent by task type"
          data={value.timeByTaskType.map((x) => ({
            label: x.taskType,
            actualMinutes: x.actualMinutes,
          }))}
          dataKey="actualMinutes"
          unit=" minutes reported"
        />
        <ReportStatusByMember rows={value.reportStatusByMember} />
      </div>
      <ActivityFeed
        items={activity.data?.data.data ?? []}
        loading={activity.isLoading}
        error={activity.isError}
        more={activity.data?.data.pagination.hasMore ?? false}
        onMore={() => setPage((p) => p + 1)}
      />
      <Link className="auth-link" to="/reports">
        View reports
      </Link>
    </div>
  );
}
