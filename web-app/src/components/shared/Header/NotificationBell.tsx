import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "../../../features/notifications/api/notificationsApi";

function relativeTime(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  return seconds < 60
    ? "Just now"
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : seconds < 86400
        ? `${Math.floor(seconds / 3600)}h ago`
        : `${Math.floor(seconds / 86400)}d ago`;
}

export function NotificationBell({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { hasPermission } = useAuth();
  const enabled = hasPermission("notification:read_own");
  const ref = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError } = useGetNotificationsQuery(
    { page: 1, pageSize: 5, readStatus: "all" },
    { skip: !enabled || !open },
  );
  const { data: unread } = useGetUnreadCountQuery(undefined, {
    skip: !enabled,
  });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAll, { isLoading: markingAll }] =
    useMarkAllNotificationsReadMutation();
  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [onOpenChange, open]);
  if (!enabled) return null;
  const count = unread?.data.count ?? 0;
  const notifications = data?.data.data ?? [];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        onClick={() => onOpenChange(!open)}
        className="relative grid size-9 place-items-center rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      >
        ⌁
        {count > 0 && (
          <span className="absolute right-0 top-0 min-w-4 rounded bg-blue-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <section
          role="menu"
          className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Notifications
            </h2>
            {count > 0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void markAll()}
                className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-60"
              >
                Mark all read
              </button>
            )}
          </header>
          <div className="max-h-96 overflow-auto">
            {isLoading && !data && (
              <p className="p-4 text-sm text-slate-500">
                Loading notifications…
              </p>
            )}
            {isError && (
              <p className="p-4 text-sm text-red-700">
                Could not load notifications.
              </p>
            )}
            {data && notifications.length === 0 && (
              <p className="p-4 text-sm text-slate-500">
                You’re all caught up.
              </p>
            )}
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (!item.readAt) void markRead(item.id);
                  onOpenChange(false);
                }}
                className={`block w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 ${item.readAt ? "" : "bg-blue-50/50"}`}
              >
                <div className="flex gap-2">
                  <span
                    className="mt-1 size-2 shrink-0 rounded-full bg-blue-600"
                    aria-hidden={item.readAt !== null}
                    style={{ visibility: item.readAt ? "hidden" : "visible" }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500">
                      {item.message}
                    </span>
                    <time
                      className="mt-1 block text-xs text-slate-400"
                      dateTime={item.createdAt}
                      title={new Date(item.createdAt).toLocaleString()}
                    >
                      {relativeTime(item.createdAt)}
                    </time>
                  </span>
                </div>
              </button>
            ))}
          </div>
          <Link
            to={ROUTES.notifications}
            onClick={() => onOpenChange(false)}
            className="block px-3 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            View all notifications
          </Link>
        </section>
      )}
    </div>
  );
}
