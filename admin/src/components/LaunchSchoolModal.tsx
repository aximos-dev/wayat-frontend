import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { APIProvider, ColorScheme, Map, Marker } from "@vis.gl/react-google-maps";
import { Modal } from "./Modal";
import { FitBounds, MAP_LIBRARIES, SCHOOL_MARKER_ICON, numberedMarkerIcon } from "./routeMapShared";
import { useLaunchPlan, useLaunchSchool } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError } from "../lib/types";

// One colour per drafted route, so the map shows which homes each van covers.
const ROUTE_COLORS = ["#FFC531", "#4EA1F7", "#39C689", "#E76161", "#B48CF2", "#F29B4E"];

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Launching a school: the stops and van routes drafted from the waiting families' homes, a van for
 * each route, a start date and how long families get to confirm. "Launch" creates it all and
 * sends every family an offer — one decision for the school instead of one approval per family.
 */
export function LaunchSchoolModal({ schoolRef, onClose }: { schoolRef: string; onClose: () => void }) {
  const [mergeM, setMergeM] = useState(400);
  const plan = useLaunchPlan(schoolRef, mergeM);
  const launch = useLaunchSchool(schoolRef);
  const { showSuccess, showError } = useToast();
  const [vehicleIds, setVehicleIds] = useState<Record<number, string>>({});
  const [startsOn, setStartsOn] = useState(tomorrow);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("07:00");
  const [offerDays, setOfferDays] = useState(7);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const data = plan.data;

  const points = useMemo(() => {
    if (!data) return [];
    const p = data.routes.flatMap((r) => r.stops.map((s) => ({ lat: s.lat, lng: s.lng })));
    if (data.schoolLat != null && data.schoolLng != null) p.push({ lat: data.schoolLat, lng: data.schoolLng });
    return p;
  }, [data]);

  const chosen = data?.routes.map((_, i) => vehicleIds[i]) ?? [];
  const ready = data != null && data.routes.length > 0 && chosen.every(Boolean) && new Set(chosen).size === chosen.length;

  async function submit() {
    if (!data || !ready) return;
    try {
      const result = await launch.mutateAsync({
        startsOn,
        offerDays,
        morningStartTime: startTime,
        stopMergeM: mergeM,
        vehicleIds: chosen as string[],
      });
      showSuccess(`${result.schoolName} launched — ${result.routes.length} routes, ${result.offersSent} families offered a seat`);
      onClose();
    } catch (err) {
      showError(isAxiosError<ApiError>(err) ? (err.response?.data.message ?? "Launch failed") : "Launch failed");
    }
  }

  return (
    <Modal maxWidthClassName="max-w-5xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Launch {data?.schoolName ?? "school"}</h2>
          <p className="mt-1 text-sm text-text-muted">
            Stops and routes drafted from the waiting families' homes. Pick a van for each route and a start date — every
            family then gets an offer to confirm in the app. Nothing is charged until they do.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text-primary">
          Close
        </button>
      </div>

      {plan.isLoading || !data ? (
        <p className="text-sm text-text-muted">Drafting routes…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="flex flex-col gap-4">
            {apiKey && (
              <APIProvider apiKey={apiKey} libraries={MAP_LIBRARIES}>
                <div className="h-80 w-full overflow-hidden rounded-xl border border-border">
                  <Map defaultCenter={points[0] ?? { lat: 12.97, lng: 77.59 }} defaultZoom={12} disableDefaultUI clickableIcons={false} colorScheme={ColorScheme.DARK}>
                    <FitBounds points={points} />
                    {data.schoolLat != null && data.schoolLng != null && (
                      <Marker position={{ lat: data.schoolLat, lng: data.schoolLng }} icon={SCHOOL_MARKER_ICON} title={data.schoolName} />
                    )}
                    {data.routes.flatMap((r, ri) =>
                      r.stops.map((s, si) => (
                        <Marker
                          key={`${ri}-${si}`}
                          position={{ lat: s.lat, lng: s.lng }}
                          icon={numberedMarkerIcon(si + 1, ROUTE_COLORS[ri % ROUTE_COLORS.length])}
                          title={`${r.name} · stop ${si + 1}: ${s.name} (${s.children})`}
                        />
                      )),
                    )}
                  </Map>
                </div>
              </APIProvider>
            )}

            <div className="flex flex-col gap-3">
              {data.routes.map((r, ri) => {
                const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
                return (
                  <div key={ri} className="rounded-xl border border-border bg-bg-base p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                        {r.name}
                        <span className="font-normal text-text-muted">
                          · {r.stops.length} stops · {r.children} children
                        </span>
                      </p>
                      <select
                        value={vehicleIds[ri] ?? ""}
                        onChange={(e) => setVehicleIds({ ...vehicleIds, [ri]: e.target.value })}
                        className="rounded-md border border-border bg-bg-surface px-2 py-1.5 text-sm text-text-primary"
                      >
                        <option value="">Choose a van…</option>
                        {data.vehicles.map((v) => {
                          const taken = Object.entries(vehicleIds).some(([k, id]) => Number(k) !== ri && id === v.id);
                          return (
                            <option key={v.id} value={v.id} disabled={!v.free || taken || v.seats < r.children}>
                              {v.regNo} · {v.seats} seats
                              {!v.free ? " (runs a route)" : v.seats < r.children ? " (too small)" : taken ? " (chosen)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <ol className="flex flex-col gap-1">
                      {r.stops.map((s, si) => (
                        <li key={si} className="flex justify-between gap-3 text-xs">
                          <span className="text-text-primary">
                            {si + 1}. {s.name}
                          </span>
                          <span className="text-text-muted">
                            {s.families.map((f) => (f.stale ? `${f.parentName} (stale, spare seat)` : f.parentName)).join(", ")} · {s.children} child
                            {s.children === 1 ? "" : "ren"}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
              {data.staleNotOffered.length > 0 && (
                <p className="text-xs text-text-muted">
                  Not offered — quiet for a while and no seat left near them (they stay on the waitlist):{" "}
                  {data.staleNotOffered.join(", ")}
                </p>
              )}
              {data.leftOut.length > 0 && (
                <p className="text-xs text-text-muted">
                  Not in this launch (another child waits for a school we don't serve yet): {data.leftOut.join(", ")}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-bg-base p-4">
              <div>
                <p className="text-xs text-text-muted">Families</p>
                <p className="text-sm font-medium text-text-primary">{data.families}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Children</p>
                <p className="text-sm font-medium text-text-primary">{data.children}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Routes</p>
                <p className="text-sm font-medium text-text-primary">{data.routes.length}</p>
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-sm text-text-muted">
              Homes share a stop within
              <select
                value={mergeM}
                onChange={(e) => {
                  setMergeM(Number(e.target.value));
                  setVehicleIds({});
                }}
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary"
              >
                {[200, 300, 400, 600, 800].map((m) => (
                  <option key={m} value={m}>
                    {m} m {m === 400 ? "(default)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text-muted">
              First day of service
              <input
                type="date"
                value={startsOn}
                min={today}
                onChange={(e) => setStartsOn(e.target.value)}
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text-muted">
              Morning departure
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-text-muted">
              Families have this long to confirm
              <select
                value={offerDays}
                onChange={(e) => setOfferDays(Number(e.target.value))}
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary"
              >
                {[3, 5, 7, 10, 14].map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              disabled={!ready || launch.isPending}
              onClick={() => void submit()}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-bg-base transition-opacity disabled:opacity-40"
            >
              {launch.isPending ? "Launching…" : `Launch & offer ${data.families} families a seat`}
            </button>
            {!ready && <p className="text-xs text-text-muted">Choose a different van for each route to launch.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
