import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import { useGetNotificationsQuery, useGetUnreadCountQuery, useMarkNotificationReadMutation } from "../../../features/notifications/api/notificationsApi";
import { notificationDestination } from "../../../features/notifications/utils/notificationDestination";

export function NotificationBell({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { hasPermission } = useAuth();
  const enabled = hasPermission("notification:read_own");
  const ref = useRef<HTMLDivElement>(null); const navigate = useNavigate();
  const { data: unread } = useGetUnreadCountQuery(undefined, { skip: !enabled });
  const { data, isLoading } = useGetNotificationsQuery({ page: 1, pageSize: 5, readStatus: "all" }, { skip: !enabled || !open });
  const [markRead] = useMarkNotificationReadMutation();
  useEffect(() => { if (!open) return; const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) onOpenChange(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, [open, onOpenChange]);
  if (!enabled) return null;
  const count = unread?.data.count ?? 0; const notifications = data?.data.data ?? [];
  return <div ref={ref} className="relative">
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Notifications${count ? `, ${count} unread` : ""}`} onClick={() => onOpenChange(!open)} className="relative grid size-9 place-items-center rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M18 10a6 6 0 0 0-12 0v4c0 .9-.3 1.7-.9 2.4L4 17h16l-1.1-0.6A3.6 3.6 0 0 1 18 14v-4ZM10 21h4" /></svg>
      {count > 0 && <span className="absolute right-0 top-0 min-w-4 rounded bg-blue-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">{count > 99 ? "99+" : count}</span>}
    </button>
    {open && <section role="menu" className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-100 px-3 py-2 text-sm font-semibold text-slate-900">Notifications</header><div className="max-h-96 overflow-auto">{isLoading ? <p className="p-4 text-sm text-slate-500">Loading notifications…</p> : notifications.length === 0 ? <p className="p-4 text-sm text-slate-500">You’re all caught up.</p> : notifications.map((item) => <button key={item.id} type="button" onClick={() => { if (!item.readAt) void markRead(item.id); onOpenChange(false); navigate(notificationDestination(item)); }} className={`block w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 ${item.readAt ? "" : "bg-blue-50/50"}`}><span className="block truncate text-sm font-medium text-slate-800">{item.title}</span><span className="mt-1 block line-clamp-2 text-xs text-slate-500">{item.message}</span></button>)}</div><Link to={ROUTES.notifications} onClick={() => onOpenChange(false)} className="block px-3 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-50">View all notifications</Link></section>}
  </div>;
}
