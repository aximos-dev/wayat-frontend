import clsx from "clsx";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/live-operations", label: "Live Operations" },
  { to: "/approvals", label: "Approvals" },
  { to: "/students", label: "Students" },
  { to: "/drivers-vehicles", label: "Drivers & Vehicles" },
  { to: "/routes-stops", label: "Routes & Stops" },
  { to: "/settings", label: "Settings" },
];

export function AppShell() {
  const { principal, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-bg-base">
      <aside className="flex w-60 flex-col justify-between border-r border-border px-4 py-5">
        <div>
          <div className="mb-8 flex items-center gap-2 px-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="text-base font-semibold text-text-primary">wayAt</span>
            <span className="text-sm text-text-muted">admin</span>
          </div>

          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-accent-bg text-accent-muted"
                      : "text-text-muted hover:text-text-primary",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        isActive ? "bg-accent" : "bg-text-muted",
                      )}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between rounded-md bg-bg-surface px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-bg-base">
              {principal?.role === "ADMIN" ? "A" : "?"}
            </span>
            <div className="leading-tight">
              <p className="text-sm text-text-primary">School Admin</p>
              <p className="text-xs text-text-muted">{principal?.tenantId.slice(0, 8)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-xs text-text-muted hover:text-danger"
            title="Log out"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
