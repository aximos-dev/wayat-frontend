import clsx from "clsx";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { usePlatformMe, usePlatformTenants } from "../lib/platform";
import { useTenant } from "../lib/queries";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/live-operations", label: "Live Operations" },
  { to: "/approvals", label: "Approvals" },
  // Only our own fleet (an OPERATOR tenant) has a demand board — schools don't.
  { to: "/demand", label: "Demand", fleetOnly: true },
  { to: "/students", label: "Students" },
  { to: "/drivers-vehicles", label: "Drivers & Vehicles" },
  { to: "/routes-stops", label: "Routes & Stops" },
  { to: "/settings", label: "Settings" },
];

/** Our ops team's own pages — only for a super admin. */
const PLATFORM_ITEMS = [
  { to: "/platform", label: "Fleet overview", end: true },
  { to: "/platform/tenants", label: "Schools & fleets" },
];

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
          isActive ? "bg-accent-bg text-accent-muted" : "text-text-muted hover:text-text-primary",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={clsx("inline-block h-1.5 w-1.5 rounded-full", isActive ? "bg-accent" : "bg-text-muted")} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-1 mt-5 px-3 text-[11px] font-medium uppercase tracking-wider text-text-muted/70">{children}</p>;
}

export function AppShell() {
  const { principal, isSuperAdmin, actAs, logout } = useAuth();
  const navigate = useNavigate();
  const tenantId = principal?.tenantId ?? "";
  const tenant = useTenant(tenantId);
  const me = usePlatformMe(isSuperAdmin);
  const tenants = usePlatformTenants(isSuperAdmin);
  const fleets = (tenants.data ?? []).filter((t) => t.type === "OPERATOR");
  const schools = (tenants.data ?? []).filter((t) => t.type === "SCHOOL");

  function stepInto(id: string) {
    if (!id) {
      actAs(null);
      navigate("/platform");
      return;
    }
    actAs(id);
    navigate("/routes-stops");
  }

  return (
    <div className="flex min-h-screen bg-bg-base">
      <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-border px-4 py-5">
        <div>
          <div className="mb-6 flex items-center gap-2 px-2">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            <span className="text-base font-semibold text-text-primary">wayAt</span>
            <span className="text-sm text-text-muted">{isSuperAdmin ? "ops" : "admin"}</span>
          </div>

          {isSuperAdmin && (
            <>
              <nav className="flex flex-col gap-1">
                {PLATFORM_ITEMS.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </nav>

              <SectionLabel>Work inside</SectionLabel>
              <select
                value={principal?.tenantId ?? ""}
                onChange={(e) => stepInto(e.target.value)}
                className="w-full rounded-md border border-border bg-bg-surface px-2.5 py-2 text-sm text-text-primary"
              >
                <option value="">Choose a school or fleet…</option>
                {fleets.length > 0 && (
                  <optgroup label="Our fleets">
                    {fleets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {schools.length > 0 && (
                  <optgroup label="Partner schools">
                    {schools.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </>
          )}

          {principal && (
            <>
              {isSuperAdmin && <SectionLabel>{tenant.data?.name ?? "…"}</SectionLabel>}
              <nav className="flex flex-col gap-1">
                {NAV_ITEMS.filter((item) => !("fleetOnly" in item) || tenant.data?.type === "OPERATOR").map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </nav>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 rounded-md bg-bg-surface px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-bg-base">
              {isSuperAdmin ? (me.data?.name?.[0] ?? "O") : "A"}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm text-text-primary">
                {isSuperAdmin ? (me.data?.name ?? "wayAt ops") : (tenant.data?.name ?? "School Admin")}
              </p>
              <p className="text-xs text-text-muted">{isSuperAdmin ? "wayAt ops" : "Admin"}</p>
            </div>
          </div>
          <button type="button" onClick={() => void logout()} className="text-xs text-text-muted hover:text-danger" title="Log out">
            Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {isSuperAdmin && principal && (
          <div className="flex items-center justify-between gap-4 border-b border-warning/30 bg-warning-bg px-8 py-2.5 text-sm">
            <p className="text-warning">
              You're working inside <span className="font-semibold">{tenant.data?.name ?? "…"}</span> as wayAt ops — every change is
              logged under your name.
            </p>
            <button type="button" onClick={() => stepInto("")} className="shrink-0 font-medium text-warning hover:underline">
              Back to fleet overview
            </button>
          </div>
        )}
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
