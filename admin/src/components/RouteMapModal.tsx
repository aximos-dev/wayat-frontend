import { useMemo } from "react";
import { APIProvider, ColorScheme, Map, Marker, Polyline, useMapsLibrary } from "@vis.gl/react-google-maps";
import { formatDistance, formatDuration } from "../lib/format";
import type { Route, RouteStopView, School, Stop } from "../lib/types";
import { Modal } from "./Modal";
import { APPROX_LINE_COLOR, DEPOT_MARKER_ICON, FitBounds, FlagIcon, MAP_LIBRARIES, SCHOOL_MARKER_ICON, numberedMarkerIcon } from "./routeMapShared";

const DEFAULT_CENTER = { lat: 12.9352, lng: 77.5623 };

interface OrderedStop {
  routeStop: RouteStopView;
  stop: Stop;
}

/**
 * Draws the actual road shape instead of a straight line between stops — decodes each leg's
 * stored `roadPolylineToNext` (see backend GoogleRoutesClient.kt) via the Maps JS "geometry"
 * library. A leg with no stored polyline (API failed/was skipped when the route was created, or
 * the route predates this column) falls back to a plain straight segment, drawn in a visibly
 * different muted color rather than pretending it's a real road path.
 */
function RoadPath({
  orderedStops,
  schoolPoint,
  depotPoint,
  depotPolylineToFirstStop,
}: {
  orderedStops: OrderedStop[];
  schoolPoint: google.maps.LatLngLiteral | null;
  depotPoint: google.maps.LatLngLiteral | null;
  depotPolylineToFirstStop: string | null;
}) {
  const geometryLibrary = useMapsLibrary("geometry");

  const segments = useMemo(() => {
    if (!geometryLibrary) return [];
    const result: { path: google.maps.LatLngLiteral[]; isApprox: boolean }[] = [];
    if (depotPoint && orderedStops.length > 0) {
      if (depotPolylineToFirstStop) {
        const decoded = geometryLibrary.encoding
          .decodePath(depotPolylineToFirstStop)
          .map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));
        result.push({ path: decoded, isApprox: false });
      } else {
        result.push({
          path: [depotPoint, { lat: orderedStops[0].stop.lat, lng: orderedStops[0].stop.lng }],
          isApprox: true,
        });
      }
    }
    orderedStops.forEach((current, index) => {
      const next = index < orderedStops.length - 1 ? orderedStops[index + 1].stop : null;
      const nextPoint = next ? { lat: next.lat, lng: next.lng } : schoolPoint;
      if (!nextPoint) return;

      const encoded = current.routeStop.roadPolylineToNext;
      if (encoded) {
        const decoded = geometryLibrary.encoding
          .decodePath(encoded)
          .map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));
        result.push({ path: decoded, isApprox: false });
      } else {
        result.push({
          path: [{ lat: current.stop.lat, lng: current.stop.lng }, nextPoint],
          isApprox: true,
        });
      }
    });
    return result;
  }, [geometryLibrary, orderedStops, schoolPoint, depotPoint, depotPolylineToFirstStop]);

  return (
    <>
      {segments.map((segment, index) => (
        <Polyline
          key={index}
          path={segment.path}
          strokeColor={segment.isApprox ? APPROX_LINE_COLOR : "#FFC531"}
          strokeOpacity={segment.isApprox ? 0.9 : 0.85}
          strokeWeight={segment.isApprox ? 2.5 : 3}
          geodesic={segment.isApprox}
        />
      ))}
    </>
  );
}

export function RouteMapModal({
  route,
  stopsPool,
  school,
  onClose,
}: {
  route: Route;
  stopsPool: Stop[];
  school: School | null;
  onClose: () => void;
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const orderedStops: OrderedStop[] = useMemo(
    () =>
      route.stops
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((routeStop) => {
          const stop = stopsPool.find((s) => s.id === routeStop.stopId);
          return stop ? { routeStop, stop } : null;
        })
        .filter((os): os is OrderedStop => os != null),
    [route.stops, stopsPool],
  );
  const stopPoints = useMemo(() => orderedStops.map((os) => os.stop), [orderedStops]);

  const schoolPoint = school
    ? { lat: school.lat, lng: school.lng, name: school.name }
    : null;
  const depotPoint =
    route.vehicleDepotLat != null && route.vehicleDepotLng != null
      ? { lat: route.vehicleDepotLat, lng: route.vehicleDepotLng, name: route.vehicleDepotName ?? "Depot" }
      : null;

  const allPoints = useMemo(() => {
    const points = stopPoints.map((s) => ({ lat: s.lat, lng: s.lng }));
    if (schoolPoint) points.push({ lat: schoolPoint.lat, lng: schoolPoint.lng });
    if (depotPoint) points.unshift({ lat: depotPoint.lat, lng: depotPoint.lng });
    return points;
  }, [stopPoints, schoolPoint, depotPoint]);

  // The depot leg counts toward the same "known vs. partial" total as every other leg — it's
  // computed and stored exactly the same way (see backend RouteService.saveRouteStopsWithLegs),
  // just not attached to a RouteStop row.
  const knownLegs = orderedStops.filter((os) => os.routeStop.roadDistanceToNextM != null);
  const hasKnownDepotLeg = depotPoint != null && route.depotDistanceToFirstStopM != null;
  const totalKnownM =
    knownLegs.reduce((sum, os) => sum + (os.routeStop.roadDistanceToNextM ?? 0), 0) +
    (route.depotDistanceToFirstStopM ?? 0);
  const totalKnownS =
    knownLegs.reduce((sum, os) => sum + (os.routeStop.roadDurationToNextS ?? 0), 0) +
    (route.depotDurationToFirstStopS ?? 0);
  const totalLegs = orderedStops.length + (depotPoint != null ? 1 : 0);
  const totalKnownLegs = knownLegs.length + (hasKnownDepotLeg ? 1 : 0);
  const isPartial = totalKnownLegs < totalLegs;

  return (
    <Modal maxWidthClassName="max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{route.name}</h2>
          <p className="mt-1 text-sm text-text-muted">
            Map preview — stops in order, ending at the destination school.
          </p>
          {totalKnownLegs > 0 && (
            <p
              className="mt-1 text-sm text-text-primary"
              title={isPartial ? `${totalKnownLegs} of ${totalLegs} legs known` : undefined}
            >
              Total: {formatDistance(totalKnownM)} · {formatDuration(totalKnownS)}
              {isPartial && <span className="text-warning"> *</span>}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-text-muted hover:text-text-primary"
        >
          ✕
        </button>
      </div>

      {!apiKey && (
        <p className="mt-4 rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
          Google Maps API key missing — set VITE_GOOGLE_MAPS_API_KEY in .env.development.local.
        </p>
      )}

      {apiKey && allPoints.length === 0 && (
        <p className="mt-4 rounded-md bg-bg-base px-3 py-2.5 text-sm text-text-muted">
          None of this route's stops have a resolvable location to preview.
        </p>
      )}

      {apiKey && allPoints.length > 0 && (
        <APIProvider apiKey={apiKey} libraries={MAP_LIBRARIES}>
          <div className="mt-4 h-96 w-full overflow-hidden rounded-md border border-border">
            <Map
              defaultCenter={allPoints[0] ?? DEFAULT_CENTER}
              defaultZoom={12}
              disableDefaultUI
              clickableIcons={false}
              colorScheme={ColorScheme.DARK}
            >
              <FitBounds points={allPoints} />
              <RoadPath
                orderedStops={orderedStops}
                schoolPoint={schoolPoint}
                depotPoint={depotPoint}
                depotPolylineToFirstStop={route.depotPolylineToFirstStop}
              />
              {depotPoint && (
                <Marker
                  position={{ lat: depotPoint.lat, lng: depotPoint.lng }}
                  icon={DEPOT_MARKER_ICON}
                  title={depotPoint.name}
                />
              )}
              {stopPoints.map((stop, index) => (
                <Marker
                  key={stop.id}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  icon={numberedMarkerIcon(index + 1)}
                />
              ))}
              {schoolPoint && (
                <Marker
                  position={{ lat: schoolPoint.lat, lng: schoolPoint.lng }}
                  icon={SCHOOL_MARKER_ICON}
                />
              )}
            </Map>
          </div>
          <p className="mt-2 flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-accent" /> Real road path
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-text-muted" /> Straight-line estimate
              (no road data for this leg)
            </span>
          </p>
        </APIProvider>
      )}

      <div className="mt-4 flex flex-col gap-1.5">
        {depotPoint && (
          <div className="flex items-center gap-2.5 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-base text-text-muted">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                <path d="M3 11 12 4 21 11 V20 A1 1 0 0 1 20 21 H4 A1 1 0 0 1 3 20 Z" />
              </svg>
            </span>
            <span className="text-text-primary">
              {depotPoint.name} <span className="text-text-muted">— depot, stop 0</span>
            </span>
          </div>
        )}
        {stopPoints.map((stop, index) => (
          <div key={stop.id} className="flex items-center gap-2.5 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-bg text-xs font-semibold text-accent-muted">
              {index + 1}
            </span>
            <span className="text-text-primary">{stop.name}</span>
          </div>
        ))}
        {schoolPoint ? (
          <div className="flex items-center gap-2.5 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
              <FlagIcon className="h-3 w-3" />
            </span>
            <span className="text-text-primary">
              {schoolPoint.name} <span className="text-text-muted">— destination school</span>
            </span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-text-muted">
            No destination school is set up for this tenant yet — set one up under
            Settings → General.
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
