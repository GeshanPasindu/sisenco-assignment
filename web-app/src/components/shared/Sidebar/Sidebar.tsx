import { NavLink } from "react-router-dom";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import { useGetUnreadCountQuery } from "../../../features/notifications/api/notificationsApi";
import { useAppShell } from "../../../layouts/AppShellProvider";
import { getVisibleSidebarItems } from "./sidebar.config";

const icons: Record<string, string> = { dashboard: "▦", reports: "▤", tasks: "✓", projects: "▣", users: "♙", notifications: "♢" };

export function Sidebar() {
  const { role, permissions } = useAuth();
  const { isSidebarCollapsed, isMobileSidebarOpen, closeMobileSidebar, toggleSidebar } = useAppShell();
  const { data } = useGetUnreadCountQuery(undefined, { skip: !permissions.includes("notification:read_own") });
  const items = getVisibleSidebarItems(role?.code, permissions);
  const content = <nav className="space-y-1" aria-label="Main navigation">{items.map((item) => {
    const unread = item.id === "notifications" ? (data?.data.count ?? 0) : 0;
    return <NavLink key={item.id} to={item.path} end={item.end} onClick={closeMobileSidebar} title={isSidebarCollapsed ? item.label : undefined} className={({ isActive }) => `flex min-h-10 items-center rounded-md text-sm font-medium ${isSidebarCollapsed ? "justify-center px-2" : "justify-between px-3"} ${isActive ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
      <span className="flex items-center gap-3"><span className="grid size-5 place-items-center text-base" aria-hidden="true">{icons[item.id]}</span><span className={isSidebarCollapsed ? "sr-only" : ""}>{item.label}</span></span>
      {!isSidebarCollapsed && unread > 0 && <span className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{unread > 99 ? "99+" : unread}</span>}
    </NavLink>;
  })}</nav>;
  const brand = <div className={`mb-5 flex items-center ${isSidebarCollapsed ? "min-h-8 justify-center" : "min-h-10 justify-between px-2"}`}><span className={`font-semibold text-slate-900 ${isSidebarCollapsed ? "sr-only" : "text-lg"}`}>Task Manager</span><button type="button" className="button-secondary hidden items-center justify-center p-0 md:inline-flex" style={{ width: 32, height: 32, minHeight: 32 }} aria-label="Toggle sidebar" onClick={toggleSidebar}><svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 5h14M5 12h14M5 19h14" /></svg></button></div>;
  return <>
    <aside className={`hidden shrink-0 border-r border-slate-200 bg-white p-3 md:block ${isSidebarCollapsed ? "w-16" : "w-56"}`}>{brand}{content}</aside>
    {isMobileSidebarOpen && <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation"><button className="absolute inset-0 bg-slate-950/20" type="button" aria-label="Close navigation" onClick={closeMobileSidebar} /><aside className="relative h-full w-72 bg-white p-4 shadow-lg"><div className="mb-5 text-lg font-semibold text-slate-900">Task Manager</div>{content}</aside></div>}
  </>;
}
