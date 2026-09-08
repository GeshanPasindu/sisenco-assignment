import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import { useAuth } from "../../../features/auth/hooks/useAuth";
import { useLogout } from "../../../features/auth/hooks/useLogout";

export function ProfileMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { user } = useAuth();
  const { signOut, isLoggingOut } = useLogout();
  const ref = useRef<HTMLDivElement>(null);
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
  if (!user) return null;
  const initials =
    `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex h-9 items-center gap-2 rounded-md px-1 text-left hover:bg-slate-50"
      >
        <span className="grid size-8 place-items-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800">
          {initials}
        </span>
        <span className="hidden text-sm font-medium text-slate-700 sm:block">
          {user.firstName} {user.lastName}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-slate-200 bg-white p-2 shadow-sm"
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1 text-xs text-slate-500">{user.role.name}</p>
          </div>
          <Link
            role="menuitem"
            to={ROUTES.profile}
            onClick={() => onOpenChange(false)}
            className="mt-1 block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Profile
          </Link>
          <Link
            role="menuitem"
            to={ROUTES.changePassword}
            onClick={() => onOpenChange(false)}
            className="block rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Change password
          </Link>
          <button
            role="menuitem"
            type="button"
            disabled={isLoggingOut}
            onClick={() => void signOut()}
            className="block w-full rounded px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
