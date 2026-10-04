import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useDeleteStop, useRoutes, useStops, useVehicles } from "../lib/queries";
import { AddStopModal } from "../components/AddStopModal";

type Tab = "routes" | "vehicles" | "stops";

export function RoutesStopsPage() {
  const { principal } = useAuth();
  const tenantId = principal!.tenantId;
  const [tab, setTab] = useState<Tab>("routes");
  const [addStopOpen, setAddStopOpen] = useState(false);

  const routes = useRoutes(tenantId);
  const vehicles = useVehicles(tenantId);
  const stops = useStops(tenantId);
  const deleteStop = useDeleteStop(tenantId);

  const stopCount = stops.data?.length ?? 0;
  const routeCount = routes.data?.length ?? 0;

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
          <Link
            to="/routes-stops/routes/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
          >
            + Add route
          </Link>
        )}
        {tab === "vehicles" && (
          <Link
            to="/routes-stops/vehicles/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
          >
            + Add vehicle
          </Link>
        )}
        {tab === "stops" && (
          <button
            type="button"
            onClick={() => setAddStopOpen(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
          >
            + Add stop
          </button>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {(["routes", "vehicles", "stops"] as const).map((t) => (
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

      <div className="overflow-hidden rounded-xl border border-border">
        {tab === "routes" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-muted">
                <th className="px-5 py-3 font-medium">Route</th>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium">Stops</th>
                <th className="px-5 py-3 font-medium">Road distance</th>
              </tr>
            </thead>
            <tbody>
              {routes.isLoading && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={4}>Loading…</td></tr>
              )}
              {routes.data?.length === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={4}>No routes yet.</td></tr>
              )}
              {routes.data?.map((route) => {
                const vehicle = vehicles.data?.find((v) => v.id === route.vehicleId);
                const knownLegs = route.stops.filter((s) => s.roadDistanceToNextM != null);
                const totalKnownM = knownLegs.reduce((sum, s) => sum + (s.roadDistanceToNextM ?? 0), 0);
                return (
                  <tr key={route.id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium text-text-primary">{route.name}</td>
                    <td className="px-5 py-3 text-text-muted">{vehicle ? vehicle.regNo : "—"}</td>
                    <td className="px-5 py-3 text-text-muted">{route.stops.length}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {knownLegs.length > 0
                        ? `${(totalKnownM / 1000).toFixed(1)} km (${knownLegs.length}/${Math.max(route.stops.length - 1, 0)} legs)`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === "vehicles" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-muted">
                <th className="px-5 py-3 font-medium">Reg no</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Seats</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.isLoading && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={3}>Loading…</td></tr>
              )}
              {vehicles.data?.length === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={3}>No vehicles yet.</td></tr>
              )}
              {vehicles.data?.map((vehicle) => (
                <tr key={vehicle.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium text-text-primary">{vehicle.regNo}</td>
                  <td className="px-5 py-3 text-text-muted">{vehicle.type}</td>
                  <td className="px-5 py-3 text-text-muted">{vehicle.seats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "stops" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Lat</th>
                <th className="px-5 py-3 font-medium">Lng</th>
                <th className="px-5 py-3 font-medium">Geofence</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {stops.isLoading && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={5}>Loading…</td></tr>
              )}
              {stops.data?.length === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={5}>No stops yet.</td></tr>
              )}
              {stops.data?.map((stop) => (
                <tr key={stop.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium text-text-primary">{stop.name}</td>
                  <td className="px-5 py-3 text-text-muted">{stop.lat.toFixed(5)}</td>
                  <td className="px-5 py-3 text-text-muted">{stop.lng.toFixed(5)}</td>
                  <td className="px-5 py-3 text-text-muted">{stop.geofenceM}m</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteStop.mutate(stop.id)}
                      className="text-xs text-text-muted hover:text-danger"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {addStopOpen && (
        <AddStopModal tenantId={tenantId} onClose={() => setAddStopOpen(false)} />
      )}
    </div>
  );
}
