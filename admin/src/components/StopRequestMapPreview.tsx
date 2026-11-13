import { useMemo, useState } from "react";
import { APIProvider, ColorScheme, Map, Marker } from "@vis.gl/react-google-maps";
import type { RoadLeg } from "../lib/googleRoutes";
import type { Route, School, Stop, StopRequest } from "../lib/types";
import { FitBounds, MAP_LIBRARIES, NEW_STOP_BADGE_COLOR, RoadPathSegments, SCHOOL_MARKER_ICON, numberedMarkerIcon } from "./routeMapShared";
import { RouteStopsPreviewMap } from "./RouteStopsPreviewMap";

const DEFAULT_CENTER = { lat: 12.9352, lng: 77.5623 };

// Same shape/colors as StopLocationPicker's pin — this IS the stop being reviewed, so it should
// read as "the thing in question" rather than just another stop on the route. Only used when
// there's no route being attached to (see `isAttaching` below) — an attach preview instead shows
// the target as a numbered stop in the spliced sequence, same as every other stop there.
const TARGET_MARKER_ICON: google.maps.Icon = {
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="M12 22s-8-7.1-8-13A8 8 0 0 1 20 9c0 5.9-8 13-8 13Z" fill="#FFC531" stroke="#15171C" stroke-width="1"/>' +
        '<circle cx="12" cy="9" r="2.75" fill="#15171C"/>' +
        "</svg>",
    ),
  scaledSize: { width: 34, height: 34 } as google.maps.Size,
  anchor: { x: 17, y: 31 } as google.maps.Point,
};

// A distinct blue pin for the admin's counter-proposal — same teardrop shape as the target pin
// so it still reads as "a specific point," but a different color so it's never mistaken for
// what the parent originally asked for, or for the school's green flag.
const COUNTER_PROPOSAL_MARKER_ICON: google.maps.Icon = {
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="M12 22s-8-7.1-8-13A8 8 0 0 1 20 9c0 5.9-8 13-8 13Z" fill="#4EA1F7" stroke="#15171C" stroke-width="1"/>' +
        '<circle cx="12" cy="9" r="2.75" fill="#15171C"/>' +
        "</svg>",
    ),
  scaledSize: { width: 34, height: 34 } as google.maps.Size,
  anchor: { x: 17, y: 31 } as google.maps.Point,
};

interface ResolvedStop {
  stopId: string;
  name: string;
  lat: number;
  lng: number;
  roadPolylineToNext: string | null;
}

/** Owns the legCache for one specific splice (one route + one insert position + one target
 *  location) — given a fresh `key` by the caller whenever any of those change, so React remounts
 *  a brand new instance (and thus a brand new, empty cache) instead of risking a cache entry from
 *  a *different* splice being reused just because it happened to share a key (`"<prevStopId>:
 *  __new__"` doesn't encode the target's own coordinates, so a stale cached polyline could
 *  otherwise end up drawn for a target that's since moved). Delegates everything else to
 *  `RouteStopsPreviewMap` — the exact same component (and so the exact same live-fetched-roads
 *  rendering) used while building/editing a route, rather than a bespoke patchwork of "keep the
 *  old stored legs, draw straight lines for the new ones" that used to live here and read as
 *  visually broken/doubled once an insert landed somewhere its old and new neighbors disagreed
 *  about. */
function AttachPreview({
  splicedStops,
  school,
  vehicle,
  newStopIndex,
}: {
  splicedStops: Stop[];
  school: School | null;
  vehicle: { depotName: string | null; depotLat: number | null; depotLng: number | null } | undefined;
  newStopIndex: number;
}) {
  const [legCache, setLegCache] = useState<globalThis.Map<string, RoadLeg | null>>(new globalThis.Map());

  return (
    <RouteStopsPreviewMap
      orderedStops={splicedStops}
      school={school}
      vehicle={vehicle}
      newStopIndex={newStopIndex}
      legCache={legCache}
      onLegsResolved={(results) => {
        setLegCache((prev) => {
          const next = new globalThis.Map(prev);
          results.forEach(([key, leg]) => next.set(key, leg));
          return next;
        });
      }}
    />
  );
}

/** Where a requested stop actually sits, and — when comparing against a candidate route — how
 *  it fits into that route's real run order today. `previewRoute`'s stops render as the same
 *  numbered yellow markers used everywhere else a route's order is shown (RouteMapModal,
 *  RouteStopsPreviewMap), connected by the route's real stored road path, so this reads as "the
 *  bus's actual path" rather than an arbitrary scatter of dots.
 *
 *  `insertAt` (NEW_STOP only, set once the admin opts to attach the approval to this route) is
 *  the 0-based position among `previewRoute`'s stops where the proposed stop would land. In that
 *  case this renders `AttachPreview` instead of its own map — the full spliced stop sequence run
 *  through the same live-road-fetching preview used while building a route, with the inserted
 *  stop's marker in light blue instead of the route's own yellow. */
export function StopRequestMapPreview({
  stopRequest,
  allStops,
  previewRoute,
  insertAt,
  school,
}: {
  stopRequest: StopRequest;
  allStops: Stop[];
  previewRoute: Route | null;
  insertAt: number | null;
  school: School | null;
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const schoolPoint = school ? { lat: school.lat, lng: school.lng } : null;
  // Only drawn/plotted when NOT attaching — the attach preview (`AttachPreview`, below) draws its
  // own depot marker/leg via the same `RouteStopsPreviewMap` every other depot leg goes through.
  const depotPoint =
    previewRoute?.vehicleDepotLat != null && previewRoute?.vehicleDepotLng != null
      ? { lat: previewRoute.vehicleDepotLat, lng: previewRoute.vehicleDepotLng, name: previewRoute.vehicleDepotName ?? "Depot" }
      : null;

  const target = useMemo(() => {
    if (stopRequest.type === "NEW_STOP") {
      if (stopRequest.proposedLat == null || stopRequest.proposedLng == null) return null;
      return { lat: stopRequest.proposedLat, lng: stopRequest.proposedLng };
    }
    const existing = allStops.find((s) => s.id === stopRequest.existingStopId);
    return existing ? { lat: existing.lat, lng: existing.lng } : null;
  }, [stopRequest, allStops]);

  const routeStops: ResolvedStop[] = useMemo(() => {
    if (!previewRoute) return [];
    return previewRoute.stops
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((rs) => {
        const stop = allStops.find((s) => s.id === rs.stopId);
        return stop
          ? { stopId: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng, roadPolylineToNext: rs.roadPolylineToNext }
          : null;
      })
      .filter((s): s is ResolvedStop => s != null);
  }, [previewRoute, allStops]);

  // The `insertAt <= routeStops.length` bound guards one more transient-state window: right
  // after the admin switches which route they're previewing, `routeStops` (derived fresh from
  // `previewRoute` every render) updates a render before the parent's `orderEntries` — and thus
  // `insertAt` — catches up to the new route's stop count. Treating a stale, too-large index as
  // "not attaching yet" avoids indexing past the new route's shorter stop list.
  const isAttaching =
    stopRequest.type === "NEW_STOP" && insertAt != null && insertAt <= routeStops.length && target != null;
  const targetIsOnRoute = stopRequest.type === "EXISTING_STOP" && routeStops.some((s) => s.stopId === stopRequest.existingStopId);

  const splicedStops: Stop[] = useMemo(() => {
    if (!isAttaching || insertAt == null || !target) return [];
    const toStop = (rs: ResolvedStop): Stop => ({
      id: rs.stopId,
      tenantId: "",
      name: rs.name,
      lat: rs.lat,
      lng: rs.lng,
      geofenceM: 0,
      createdAt: "",
      autoCreated: false,
      confirmedAt: null,
    });
    const stops = routeStops.map(toStop);
    stops.splice(insertAt, 0, {
      id: "__new__",
      tenantId: "",
      name: stopRequest.proposedName ?? "New stop",
      lat: target.lat,
      lng: target.lng,
      geofenceM: 0,
      createdAt: "",
      autoCreated: false,
      confirmedAt: null,
    });
    return stops;
  }, [isAttaching, insertAt, target, routeStops, stopRequest.proposedName]);

  // The numbered markers to draw, each paired with its final sequence number — only used in the
  // non-attaching views below (EXISTING_STOP, or a plain comparison with no insert chosen yet);
  // the attaching case numbers everything through `AttachPreview`/`RouteStopsPreviewMap` instead.
  // For an EXISTING_STOP request the target is already one of `routeStops` and is skipped here
  // (drawn as the pin instead, at its real position — numbers elsewhere stay as the route's
  // actual positions, unchanged).
  const numbered = useMemo(
    () =>
      routeStops
        .map((s, i) => ({ stop: s, index: i }))
        .filter(({ stop }) => !(stopRequest.type === "EXISTING_STOP" && stop.stopId === stopRequest.existingStopId))
        .map(({ stop, index }) => ({ stop, number: index + 1 })),
    [routeStops, stopRequest],
  );

  const counterProposedPoint = useMemo(() => {
    if (stopRequest.counterProposedLat == null || stopRequest.counterProposedLng == null) return null;
    return { lat: stopRequest.counterProposedLat, lng: stopRequest.counterProposedLng };
  }, [stopRequest.counterProposedLat, stopRequest.counterProposedLng]);

  const allPoints = useMemo(() => {
    const points = routeStops.map((s) => ({ lat: s.lat, lng: s.lng }));
    if (target && !targetIsOnRoute) points.push(target);
    if (counterProposedPoint) points.push(counterProposedPoint);
    if (schoolPoint) points.push(schoolPoint);
    if (depotPoint) points.unshift({ lat: depotPoint.lat, lng: depotPoint.lng });
    return points;
  }, [routeStops, target, targetIsOnRoute, counterProposedPoint, schoolPoint, depotPoint]);

  // Prepending a depot "node" lets RoadPathSegments draw it as just the first leg in the same
  // sequence — it already connects node[i] to node[i+1] in order.
  const routeStopsWithDepot: ResolvedStop[] = useMemo(
    () =>
      depotPoint
        ? [
            { stopId: "depot", name: depotPoint.name, lat: depotPoint.lat, lng: depotPoint.lng, roadPolylineToNext: previewRoute?.depotPolylineToFirstStop ?? null },
            ...routeStops,
          ]
        : routeStops,
    [depotPoint, routeStops, previewRoute?.depotPolylineToFirstStop],
  );

  if (!apiKey) {
    return (
      <p className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
        Google Maps API key missing — set VITE_GOOGLE_MAPS_API_KEY in .env.development.local.
      </p>
    );
  }

  if (!target) {
    return (
      <p className="rounded-md bg-bg-base px-3 py-2.5 text-sm text-text-muted">
        No resolvable location for this request.
      </p>
    );
  }

  if (isAttaching && insertAt != null) {
    return (
      <AttachPreview
        key={`${previewRoute?.id ?? ""}:${insertAt}:${target.lat}:${target.lng}`}
        splicedStops={splicedStops}
        school={school}
        vehicle={
          previewRoute
            ? { depotName: previewRoute.vehicleDepotName, depotLat: previewRoute.vehicleDepotLat, depotLng: previewRoute.vehicleDepotLng }
            : undefined
        }
        newStopIndex={insertAt}
      />
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={MAP_LIBRARIES}>
      <div className="h-56 w-full overflow-hidden rounded-md border border-border">
        <Map
          defaultCenter={allPoints[0] ?? target ?? DEFAULT_CENTER}
          defaultZoom={13}
          disableDefaultUI
          clickableIcons={false}
          colorScheme={ColorScheme.DARK}
        >
          <FitBounds points={allPoints.length > 0 ? allPoints : [target]} />
          <RoadPathSegments nodes={routeStopsWithDepot} finalPoint={schoolPoint} />
          {numbered.map(({ stop, number }) => (
            <Marker
              key={stop.stopId}
              position={{ lat: stop.lat, lng: stop.lng }}
              icon={numberedMarkerIcon(number)}
              title={stop.name}
            />
          ))}
          <Marker
            position={target}
            icon={TARGET_MARKER_ICON}
            title={stopRequest.type === "NEW_STOP" ? stopRequest.proposedName ?? undefined : stopRequest.existingStopName ?? undefined}
          />
          {counterProposedPoint && (
            <Marker
              position={counterProposedPoint}
              icon={COUNTER_PROPOSAL_MARKER_ICON}
              title={stopRequest.counterProposedName ?? undefined}
            />
          )}
          {schoolPoint && <Marker position={schoolPoint} icon={SCHOOL_MARKER_ICON} title={school?.name} />}
        </Map>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          {stopRequest.type === "NEW_STOP" ? "Proposed location" : "Requested stop"}
        </span>
        {counterProposedPoint && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: NEW_STOP_BADGE_COLOR }} />
            Admin's suggested location
          </span>
        )}
        {numbered.length > 0 && previewRoute && (
          <span className="flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-bg-base">
              #
            </span>
            {previewRoute.name}'s stops, in today's run order
          </span>
        )}
        {depotPoint && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#6B7280" }} />
            {depotPoint.name} — depot, stop 0
          </span>
        )}
        {schoolPoint && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-success" />
            {school?.name} — destination school
          </span>
        )}
      </p>
    </APIProvider>
  );
}
