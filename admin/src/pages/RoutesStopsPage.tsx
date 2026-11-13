import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "../lib/AuthContext";
import { usePagedSearch } from "../lib/usePagedSearch";
import { useDeleteRoute, useDeleteStop, useRoutes, useSchool, useStops, useVehicles } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import { BulkImportStopsModal } from "../components/BulkImportStopsModal";
import { PaginationBar, SearchBar } from "../components/SearchAndPagination";
import { RouteMapModal } from "../components/RouteMapModal";
import { RouteModal } from "../components/RouteModal";
import { RoutePlanModal } from "../components/RoutePlanModal";
import { StopModal } from "../components/StopModal";
import { Tooltip } from "../components/Tooltip";
import { formatDistance, formatDuration } from "../lib/format";
import type { ApiError, Route, Stop } from "../lib/types";

type Tab = "routes" | "stops";

export function RoutesStopsPage() {
  const { principal } = useAuth();
  const tenantId = principal!.tenantId;
  const [tab, setTab] = useState<Tab>("routes");
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [previewRoute, setPreviewRoute] = useState<Route | null>(null);
  const { showSuccess, showError } = useToast();

  const routes = useRoutes(tenantId);
  const vehicles = useVehicles(tenantId);
  const stops = useStops(tenantId);
  const school = useSchool(tenantId);
  const deleteStop = useDeleteStop(tenantId);
  const deleteRoute = useDeleteRoute(tenantId);

  // Which routes reference each stop — lets the Stops tab show "used by N routes" and disable
  // Delete before it ever hits the backend's STOP_IN_USE 409, instead of after.
  const routesByStopId = useMemo(() => {
    const map = new Map<string, Route[]>();
    for (const route of routes.data ?? []) {
      for (const routeStop of route.stops) {
        const existing = map.get(routeStop.stopId);
        if (existing) {
          existing.push(route);
        } else {
          map.set(routeStop.stopId, [route]);
        }
      }
    }
    return map;
  }, [routes.data]);

  function handleDeleteStop(stopId: string) {
    deleteStop.mutate(stopId, {
      onSuccess: () => showSuccess("Stop deleted"),
      onError: (err) => {
        // Surfaces the backend's own message — e.g. STOP_IN_USE's "referenced by a child or
        // route" explanation — rather than failing silently.
        if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
          showError(err.response.data.message);
        } else {
          showError("Something went wrong.");
        }
      },
    });
  }

  function handleDeleteRoute(routeId: string) {
    deleteRoute.mutate(routeId, {
      onSuccess: () => showSuccess("Route deleted"),
      onError: (err) => {
        // Surfaces the backend's own message — e.g. ROUTE_IN_USE's "referenced by a ride"
        // explanation — rather than failing silently.
        if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
          showError(err.response.data.message);
        } else {
          showError("Something went wrong.");
        }
      },
    });
  }

  const stopCount = stops.data?.length ?? 0;
  const routeCount = routes.data?.length ?? 0;

  const routesSearch = usePagedSearch(routes.data, (route, query) => {
    const vehicle = vehicles.data?.find((v) => v.id === route.vehicleId);
    return route.name.toLowerCase().includes(query) || (vehicle?.regNo.toLowerCase().includes(query) ?? false);
  });
  const stopsSearch = usePagedSearch(stops.data, (stop, query) => stop.name.toLowerCase().includes(query));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Routes & Stops</h1>
          <p className="mt-1 text-sm text-text-muted">
            {routeCount} route{routeCount === 1 ? "" : "s"} · {stopCount} stop{stopCount === 1 ? "" : "s"}
          </p>
        </div>
        {tab === "routes" && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              title="Find a faster stop order for every route, and stops worth moving between routes"
              className="rounded-md border border-border px-4 py-2 text-sm text-text-primary transition-colors hover:border-accent"
            >
              Re-plan routes
            </button>
            <button
              type="button"
              onClick={() => setAddRouteOpen(true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
            >
              + Add route
            </button>
          </div>
        )}
        {tab === "stops" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBulkImportOpen(true)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary"
            >
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setAddStopOpen(true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
            >
              + Add stop
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {(["routes", "stops"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "rounded-md px-3 py-1.5 text-sm capitalize " +
                (tab === t ? "bg-accent-bg text-accent-muted" : "text-text-muted hover:text-text-primary")
              }
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "routes" && (
          <SearchBar value={routesSearch.query} onChange={routesSearch.setQuery} placeholder="Search by route or vehicle…" />
        )}
        {tab === "stops" && (
          <SearchBar value={stopsSearch.query} onChange={stopsSearch.setQuery} placeholder="Search by name…" />
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {tab === "routes" && (
          <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
                <th className="px-5 py-3 font-medium">Route</th>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Stops</th>
                <th className="px-5 py-3 font-medium">Road distance</th>
                <th className="px-5 py-3 font-medium">Est. duration</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {routes.isLoading && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>Loading…</td></tr>
              )}
              {!routes.isLoading && routeCount === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>No routes yet.</td></tr>
              )}
              {!routes.isLoading && routeCount > 0 && routesSearch.totalCount === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>No routes match "{routesSearch.query}".</td></tr>
              )}
              {routesSearch.paged.map((route) => {
                const vehicle = vehicles.data?.find((v) => v.id === route.vehicleId);
                // Every stop has a leg to the next point (next stop, or school for the last one)
                // — so a route's full leg count equals its stop count. A route with legs still
                // missing (API failure, or saved before polyline storage existed) shows a
                // "partial" hint rather than silently understating the real total.
                const knownLegs = route.stops.filter((s) => s.roadDistanceToNextM != null);
                // The depot → first-stop leg ("stop 0") counts toward the same total, the same
                // way — only present when the route's vehicle has a depot configured.
                const hasDepotLeg = route.vehicleDepotLat != null;
                const hasKnownDepotLeg = hasDepotLeg && route.depotDistanceToFirstStopM != null;
                const totalLegs = route.stops.length + (hasDepotLeg ? 1 : 0);
                const totalKnownLegs = knownLegs.length + (hasKnownDepotLeg ? 1 : 0);
                const isPartial = totalKnownLegs < totalLegs;
                const totalKnownM =
                  knownLegs.reduce((sum, s) => sum + (s.roadDistanceToNextM ?? 0), 0) +
                  (route.depotDistanceToFirstStopM ?? 0);
                const totalKnownS =
                  knownLegs.reduce((sum, s) => sum + (s.roadDurationToNextS ?? 0), 0) +
                  (route.depotDurationToFirstStopS ?? 0);
                const partialTitle = isPartial
                  ? `${totalKnownLegs} of ${totalLegs} legs known — the rest failed or predate road-path storage`
                  : undefined;
                return (
                  <tr key={route.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                    <td className="px-5 py-3 font-medium text-text-primary">{route.name}</td>
                    <td className="px-5 py-3 text-text-muted">{vehicle ? vehicle.regNo : "—"}</td>
                    <td className="px-5 py-3 text-text-muted">{route.stops.length}</td>
                    <td className="px-5 py-3 text-text-muted" title={partialTitle}>
                      {totalKnownLegs > 0 ? formatDistance(totalKnownM) : "—"}
                      {isPartial && totalKnownLegs > 0 && <span className="text-warning"> *</span>}
                    </td>
                    <td className="px-5 py-3 text-text-muted" title={partialTitle}>
                      {totalKnownLegs > 0 ? formatDuration(totalKnownS) : "—"}
                      {isPartial && totalKnownLegs > 0 && <span className="text-warning"> *</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setPreviewRoute(route)}
                          className="text-xs text-text-muted hover:text-text-primary"
                        >
                          Map
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRoute(route)}
                          className="text-xs text-text-muted hover:text-text-primary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoute(route.id)}
                          className="text-xs text-text-muted hover:text-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationBar
            page={routesSearch.page}
            totalPages={routesSearch.totalPages}
            totalCount={routesSearch.totalCount}
            pageSize={routesSearch.pageSize}
            onPageChange={routesSearch.setPage}
          />
          </>
        )}

        {tab === "stops" && (
          <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Lat</th>
                <th className="px-5 py-3 font-medium">Lng</th>
                <th className="px-5 py-3 font-medium">Geofence</th>
                <th className="px-5 py-3 font-medium">Used in</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {stops.isLoading && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>Loading…</td></tr>
              )}
              {!stops.isLoading && stopCount === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>No stops yet.</td></tr>
              )}
              {!stops.isLoading && stopCount > 0 && stopsSearch.totalCount === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>No stops match "{stopsSearch.query}".</td></tr>
              )}
              {stopsSearch.paged.map((stop) => {
                const usedByRoutes = routesByStopId.get(stop.id) ?? [];
                return (
                  <tr key={stop.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                    <td className="px-5 py-3 font-medium text-text-primary">{stop.name}</td>
                    <td className="px-5 py-3 text-text-muted">{stop.lat.toFixed(5)}</td>
                    <td className="px-5 py-3 text-text-muted">{stop.lng.toFixed(5)}</td>
                    <td className="px-5 py-3 text-text-muted">{stop.geofenceM}m</td>
                    <td className="px-5 py-3">
                      {usedByRoutes.length === 0 ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <Tooltip
                          trigger={
                            <span className="cursor-default rounded-full bg-accent-bg px-2 py-0.5 text-xs text-accent-muted">
                              {usedByRoutes.length} route{usedByRoutes.length === 1 ? "" : "s"}
                            </span>
                          }
                          content={usedByRoutes.map((r) => r.name).join(", ")}
                        />
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingStop(stop)}
                          className="text-xs text-text-muted hover:text-text-primary"
                        >
                          Edit
                        </button>
                        {usedByRoutes.length > 0 ? (
                          <Tooltip
                            align="right"
                            trigger={
                              <span className="cursor-not-allowed text-xs text-text-muted opacity-40">
                                Delete
                              </span>
                            }
                            content={`Used by ${usedByRoutes.length} route${usedByRoutes.length === 1 ? "" : "s"} — remove it from ${usedByRoutes.length === 1 ? "that route" : "those routes"} first.`}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteStop(stop.id)}
                            className="text-xs text-text-muted hover:text-danger"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PaginationBar
            page={stopsSearch.page}
            totalPages={stopsSearch.totalPages}
            totalCount={stopsSearch.totalCount}
            pageSize={stopsSearch.pageSize}
            onPageChange={stopsSearch.setPage}
          />
          </>
        )}
      </div>

      {addStopOpen && (
        <StopModal tenantId={tenantId} onClose={() => setAddStopOpen(false)} />
      )}
      {editingStop && (
        <StopModal tenantId={tenantId} stop={editingStop} onClose={() => setEditingStop(null)} />
      )}
      {planOpen && <RoutePlanModal tenantId={tenantId} onClose={() => setPlanOpen(false)} />}

      {addRouteOpen && (
        <RouteModal
          tenantId={tenantId}
          stopsPool={stops.data ?? []}
          vehicles={vehicles.data ?? []}
          onClose={() => setAddRouteOpen(false)}
        />
      )}
      {editingRoute && (
        <RouteModal
          tenantId={tenantId}
          route={editingRoute}
          stopsPool={stops.data ?? []}
          vehicles={vehicles.data ?? []}
          onClose={() => setEditingRoute(null)}
        />
      )}
      {previewRoute && (
        <RouteMapModal
          route={previewRoute}
          stopsPool={stops.data ?? []}
          school={school.data ?? null}
          onClose={() => setPreviewRoute(null)}
        />
      )}
      {bulkImportOpen && (
        <BulkImportStopsModal tenantId={tenantId} onClose={() => setBulkImportOpen(false)} />
      )}
    </div>
  );
}
