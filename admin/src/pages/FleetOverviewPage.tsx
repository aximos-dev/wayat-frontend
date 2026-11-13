import { useMemo, useState } from "react";
import clsx from "clsx";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { APIProvider, ColorScheme, Map, Marker, Polyline } from "@vis.gl/react-google-maps";
import { Modal } from "../components/Modal";
import { FitBounds, MAP_LIBRARIES, SCHOOL_MARKER_ICON, numberedMarkerIcon } from "../components/routeMapShared";
import { useAuth } from "../lib/AuthContext";
import { useFleetOverview, useReassignVan, type FleetRoute, type FleetVehicle, type RideState } from "../lib/platform";
import { useToast } from "../lib/ToastContext";
import type { ApiError } from "../lib/types";

// One colour per route on the map (cycled), matching the dot next to its name in the table.
const ROUTE_COLORS = ["#FFC531", "#4EA1F7", "#39C689", "#E76161", "#B48CF2", "#F29B4E", "#5ED3D1", "#F27EB8"];

type Tab = "routes" | "schools" | "vans";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-surface px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-text-primary">{value}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

/** Children / seats as a small bar — amber when nearly full, red when over. */
function Fill({ riders, seats }: { riders: number; seats: number }) {
  const pct = seats > 0 ? Math.min(100, Math.round((riders / seats) * 100)) : 0;
  const tone = riders > seats ? "bg-danger" : pct >= 85 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-bg">
        <div className={clsx("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-muted">
        {riders}/{seats}
      </span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function TodayBadge({ state, startsOn }: { state: RideState | null; startsOn: string | null }) {
  const today = new Date().toISOString().slice(0, 10);
  const [label, cls] =
    startsOn && startsOn > today
      ? [`Starts ${formatDate(startsOn)}`, "bg-neutral-bg text-neutral"]
      : state === "IN_PROGRESS"
        ? ["On the road", "bg-success-bg text-success"]
        : state === "AT_SCHOOL"
          ? ["At school", "bg-success-bg text-success"]
          : state === "COMPLETED"
            ? ["Done", "bg-neutral-bg text-neutral"]
            : state === "CANCELLED"
              ? ["Cancelled", "bg-danger-bg text-danger"]
              : state === "SCHEDULED"
                ? ["Scheduled", "bg-warning-bg text-warning"]
                : ["Not started", "bg-neutral-bg text-neutral"];
  return <span className={clsx("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", cls)}>{label}</span>;
}

/**
 * Our ops team's view of every fleet at once: each school we serve, every route running to it,
 * and every van — with how full each one is, how today's ride is going, and a quick way to put a
 * different van on a route (swapping with the route that had it, if any).
 */
export function FleetOverviewPage() {
  const fleet = useFleetOverview();
  const reassign = useReassignVan();
  const { actAs } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [tab, setTab] = useState<Tab>("routes");
  const [fleetId, setFleetId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [query, setQuery] = useState("");
  const [pendingSwap, setPendingSwap] = useState<{ route: FleetRoute; van: FleetVehicle } | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const data = fleet.data;
  const fleets = useMemo(() => {
    const seen = new globalThis.Map<string, string>();
    [...(data?.schools ?? []), ...(data?.vehicles ?? [])].forEach((x) => seen.set(x.tenantId, x.tenantName));
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [data]);

  const q = query.trim().toLowerCase();
  const schools = (data?.schools ?? []).filter((s) => (!fleetId || s.tenantId === fleetId) && (!q || s.name.toLowerCase().includes(q)));
  const routes = (data?.routes ?? []).filter(
    (r) =>
      (!fleetId || r.tenantId === fleetId) &&
      (!schoolId || r.schoolId === schoolId) &&
      (!q || [r.name, r.schoolName ?? "", r.vehicleRegNo, r.driverName ?? ""].some((x) => x.toLowerCase().includes(q))),
  );
  const vans = (data?.vehicles ?? []).filter(
    (v) => (!fleetId || v.tenantId === fleetId) && (!q || [v.regNo, v.driverName ?? ""].some((x) => x.toLowerCase().includes(q))),
  );
  const schoolOptions = (data?.schools ?? []).filter((s) => !fleetId || s.tenantId === fleetId);

  const all = data?.routes ?? [];
  const spareVans = (data?.vehicles ?? []).filter((v) => v.routes.length === 0).length;
  const colorOf = (routeId: string) => ROUTE_COLORS[Math.max(0, all.findIndex((r) => r.id === routeId)) % ROUTE_COLORS.length];

  // The map follows the filters: the routes shown, plus the schools they (or the filter) point at.
  const mapSchools = (data?.schools ?? []).filter(
    (s) => (schoolId ? s.id === schoolId : routes.some((r) => r.schoolId === s.id) || (!fleetId || s.tenantId === fleetId)),
  );
  const points = useMemo(
    () => [...routes.flatMap((r) => r.stops.map((s) => ({ lat: s.lat, lng: s.lng }))), ...mapSchools.map((s) => ({ lat: s.lat, lng: s.lng }))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(routes.map((r) => r.id)), JSON.stringify(mapSchools.map((s) => s.id))],
  );

  function openTenant(tenantId: string, path = "/routes-stops") {
    actAs(tenantId);
    navigate(path);
  }

  async function changeVan(route: FleetRoute, van: FleetVehicle) {
    try {
      const result = await reassign.mutateAsync({ routeId: route.id, vehicleId: van.id });
      showSuccess(
        result.swapped
          ? `${route.name} now runs ${van.regNo}; ${result.changed
              .slice(1)
              .map((r) => r.name)
              .join(", ")} took ${route.vehicleRegNo}`
          : `${route.name} now runs ${van.regNo}`,
      );
    } catch (err) {
      showError(isAxiosError<ApiError>(err) ? (err.response?.data?.message ?? "Couldn't change the van") : "Couldn't change the van");
    } finally {
      setPendingSwap(null);
    }
  }

  function pickVan(route: FleetRoute, vehicleId: string) {
    const van = data?.vehicles.find((v) => v.id === vehicleId);
    if (!van || van.id === route.vehicleId) return;
    if (van.routes.length > 0) setPendingSwap({ route, van });
    else void changeVan(route, van);
  }

  if (fleet.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (fleet.isError || !data) return <p className="text-sm text-danger">Couldn't load the fleet.</p>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Fleet overview</h1>
        <p className="mt-1 text-sm text-text-muted">Every school our vans serve, every route running to it, and every van — across all our fleets.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Schools served" value={data.schools.filter((s) => s.routes > 0).length} hint={`${data.schools.length} on our books`} />
        <Stat label="Routes" value={all.length} hint={`${all.filter((r) => r.todayRideState === "IN_PROGRESS").length} on the road now`} />
        <Stat label="Children riding" value={all.reduce((n, r) => n + r.children, 0)} />
        <Stat label="Seats free" value={all.reduce((n, r) => n + Math.max(0, r.seatsFree), 0)} hint={`of ${all.reduce((n, r) => n + r.seats, 0)}`} />
        <Stat label="Spare vans" value={spareVans} hint={`of ${data.vehicles.length}`} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={fleetId}
          onChange={(e) => {
            setFleetId(e.target.value);
            setSchoolId("");
          }}
          className="rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="">All fleets</option>
          {fleets.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          className="rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary"
        >
          <option value="">All schools</option>
          {schoolOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search route, school, van or driver"
          className="min-w-64 flex-1 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
      </div>

      {apiKey && (
        <APIProvider apiKey={apiKey} libraries={MAP_LIBRARIES}>
          <div className="mb-6 h-80 w-full overflow-hidden rounded-xl border border-border">
            <Map defaultCenter={{ lat: 12.97, lng: 77.59 }} defaultZoom={11} disableDefaultUI clickableIcons={false} colorScheme={ColorScheme.DARK}>
              <FitBounds points={points} />
              {mapSchools.map((s) => (
                <Marker key={s.id} position={{ lat: s.lat, lng: s.lng }} icon={SCHOOL_MARKER_ICON} title={s.name} />
              ))}
              {routes.map((r) => {
                const color = colorOf(r.id);
                const school = data.schools.find((s) => s.id === r.schoolId);
                const path = [...r.stops.map((s) => ({ lat: s.lat, lng: s.lng })), ...(school ? [{ lat: school.lat, lng: school.lng }] : [])];
                return (
                  <div key={r.id}>
                    <Polyline path={path} strokeColor={color} strokeOpacity={0.8} strokeWeight={3} geodesic />
                    {r.stops.map((s, i) => (
                      <Marker
                        key={i}
                        position={{ lat: s.lat, lng: s.lng }}
                        icon={numberedMarkerIcon(i + 1, color)}
                        title={`${r.name} · stop ${i + 1}: ${s.name}`}
                      />
                    ))}
                  </div>
                );
              })}
            </Map>
          </div>
        </APIProvider>
      )}

      <div className="mb-4 flex gap-1 border-b border-border">
        {(
          [
            ["routes", `Routes (${routes.length})`],
            ["schools", `Schools (${schools.length})`],
            ["vans", `Vans (${vans.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={clsx(
              "-mb-px border-b-2 px-4 py-2 text-sm transition-colors",
              tab === key ? "border-accent text-text-primary" : "border-transparent text-text-muted hover:text-text-primary",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "routes" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface">
          {routes.length === 0 ? (
            <p className="p-6 text-sm text-text-muted">No routes match.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-4 py-3 font-medium">Route</th>
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Van</th>
                  <th className="px-4 py-3 font-medium">Driver</th>
                  <th className="px-4 py-3 font-medium">Children</th>
                  <th className="px-4 py-3 font-medium">Today</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const fleetVans = data.vehicles.filter((v) => v.tenantId === r.tenantId);
                  const busy = r.todayRideState === "IN_PROGRESS" || r.todayRideState === "AT_SCHOOL";
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="flex items-center gap-2 font-medium text-text-primary">
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(r.id) }} />
                          {r.name}
                        </p>
                        <p className="pl-[18px] text-xs text-text-muted">
                          {r.tenantName} · {r.stops.length} stops{r.morningStartTime ? ` · leaves ${r.morningStartTime.slice(0, 5)}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-primary">{r.schoolName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          value={r.vehicleId}
                          disabled={busy || reassign.isPending}
                          title={busy ? "On the road right now — change its van after today's ride" : undefined}
                          onChange={(e) => pickVan(r, e.target.value)}
                          className="max-w-52 rounded-md border border-border bg-bg-base px-2 py-1.5 text-sm text-text-primary disabled:opacity-50"
                        >
                          {fleetVans.map((v) => {
                            const others = v.routes.filter((x) => x.id !== r.id);
                            const tooSmall = v.seats < r.children;
                            return (
                              <option key={v.id} value={v.id} disabled={tooSmall && v.id !== r.vehicleId}>
                                {v.regNo} · {v.seats} seats
                                {v.id === r.vehicleId ? "" : tooSmall ? " (too small)" : others.length ? ` (runs ${others[0].name})` : " (spare)"}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-text-primary">{r.driverName ?? <span className="text-danger">No driver</span>}</td>
                      <td className="px-4 py-3">
                        <Fill riders={r.children} seats={r.seats} />
                      </td>
                      <td className="px-4 py-3">
                        <TodayBadge state={r.todayRideState} startsOn={r.startsOn} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openTenant(r.tenantId)} className="text-sm text-accent-muted hover:text-accent">
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "schools" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface">
          {schools.length === 0 ? (
            <p className="p-6 text-sm text-text-muted">No schools match.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Fleet</th>
                  <th className="px-4 py-3 font-medium">Routes</th>
                  <th className="px-4 py-3 font-medium">Vans</th>
                  <th className="px-4 py-3 font-medium">Children</th>
                  <th className="px-4 py-3 font-medium">Seats free</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-text-primary">{s.name}</td>
                    <td className="px-4 py-3 text-text-muted">{s.tenantName}</td>
                    <td className="px-4 py-3 text-text-primary">{s.routes}</td>
                    <td className="px-4 py-3 text-text-primary">{s.vans}</td>
                    <td className="px-4 py-3">{s.seats > 0 ? <Fill riders={s.children} seats={s.seats} /> : <span className="text-xs text-text-muted">No vans yet</span>}</td>
                    <td className="px-4 py-3 text-text-primary">{s.seatsFree}</td>
                    <td className="px-4 py-3 text-right">
                      {s.routes > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFleetId(s.tenantId);
                            setSchoolId(s.id);
                            setQuery("");
                            setTab("routes");
                          }}
                          className="text-sm text-accent-muted hover:text-accent"
                        >
                          Show routes
                        </button>
                      ) : (
                        <button type="button" onClick={() => openTenant(s.tenantId, "/demand")} className="text-sm text-accent-muted hover:text-accent">
                          See demand
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "vans" && (
        <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface">
          {vans.length === 0 ? (
            <p className="p-6 text-sm text-text-muted">No vans match.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-4 py-3 font-medium">Van</th>
                  <th className="px-4 py-3 font-medium">Fleet</th>
                  <th className="px-4 py-3 font-medium">Seats</th>
                  <th className="px-4 py-3 font-medium">Morning driver</th>
                  <th className="px-4 py-3 font-medium">Runs</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {vans.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-text-primary">{v.regNo}</td>
                    <td className="px-4 py-3 text-text-muted">{v.tenantName}</td>
                    <td className="px-4 py-3 text-text-primary">{v.seats}</td>
                    <td className="px-4 py-3 text-text-primary">{v.driverName ?? <span className="text-text-muted">—</span>}</td>
                    <td className="px-4 py-3">
                      {v.routes.length === 0 ? (
                        <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success">Spare</span>
                      ) : (
                        <span className="text-text-primary">
                          {v.routes.map((r) => `${r.name}${r.schoolName ? ` → ${r.schoolName}` : ""}`).join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => openTenant(v.tenantId, "/drivers-vehicles")} className="text-sm text-accent-muted hover:text-accent">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {pendingSwap && (
        <Modal>
          <h2 className="text-lg font-semibold text-text-primary">Swap vans?</h2>
          <p className="mt-2 text-sm text-text-muted">
            {pendingSwap.van.regNo} already runs {pendingSwap.van.routes.map((r) => r.name).join(", ")}. It moves to{" "}
            <span className="text-text-primary">{pendingSwap.route.name}</span>, and{" "}
            {pendingSwap.van.routes.length === 1 ? "that route" : "those routes"} get{" "}
            <span className="text-text-primary">{pendingSwap.route.vehicleRegNo}</span> instead. Drivers stay with their vans.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setPendingSwap(null)} className="rounded-md px-4 py-2 text-sm text-text-muted hover:text-text-primary">
              Cancel
            </button>
            <button
              type="button"
              disabled={reassign.isPending}
              onClick={() => void changeVan(pendingSwap.route, pendingSwap.van)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-40"
            >
              {reassign.isPending ? "Swapping…" : "Swap vans"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
