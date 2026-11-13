import { useEffect, useMemo } from "react";
import { Polyline, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";

// Shared pieces between RouteMapModal (saved-route preview) and RouteStopsPreviewMap (live
// preview while adding/editing a route) — kept in one place so the map vocabulary (marker
// shapes, colors) stays identical between "what you're building" and "what you saved".

// Every <APIProvider> in this app MUST pass this exact array to its `libraries` prop — the
// Google Maps JS SDK loads once per page as a global singleton, so whichever APIProvider mounts
// first "locks in" its library list; a later one mounted with a *different* list has its request
// silently ignored (console warning: "already been loaded with different parameters") and, in
// practice, its own Map can fail to render at all rather than just missing the extra library.
// Found live: StopLocationPicker (needs "places" for its address search) rendered as a
// completely blank map whenever it mounted after StopRequestMapPreview or RouteMapModal (both
// "geometry", for decoding stored route polylines) had already loaded the SDK first. Keeping
// every provider on the same superset — not just the specific library that one component
// happens to need — is what prevents this, regardless of mount order.
export const MAP_LIBRARIES: string[] = ["geometry", "places"];

// A light, clearly-visible gray — the muted text color (#8A8F99) that works fine for UI text
// turned out to be nearly invisible as a thin map line against this dark theme's varied terrain
// colors, so this is brighter and more saturated than you'd use for text.
export const APPROX_LINE_COLOR = "#D7DAE0";

export interface RoadPathNode {
  lat: number;
  lng: number;
  /** This node's real stored road leg to whatever comes after it (the next node, or
   *  `finalPoint` for the last one) — null falls back to a plain straight line. */
  roadPolylineToNext: string | null;
}

/** Decodes and draws each node's stored real road leg to whatever comes next, ending at
 *  `finalPoint` (typically the destination school) if given — shared by every map in this app
 *  that needs to show "the route as it actually drives" rather than a scatter of unconnected
 *  points: StopRequestMapPreview (reviewing an approval) and StopLocationPicker (picking a
 *  location in the context of an existing route's stops). A leg with no stored polyline falls
 *  back to a plain straight line. */
export function RoadPathSegments({ nodes, finalPoint }: { nodes: RoadPathNode[]; finalPoint: google.maps.LatLngLiteral | null }) {
  const geometryLibrary = useMapsLibrary("geometry");

  const segments = useMemo(() => {
    if (!geometryLibrary) return [];
    const result: { path: google.maps.LatLngLiteral[]; isApprox: boolean }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const current = nodes[i];
      const next = i < nodes.length - 1 ? nodes[i + 1] : finalPoint;
      if (!next) continue;
      if (current.roadPolylineToNext) {
        const decoded = geometryLibrary.encoding
          .decodePath(current.roadPolylineToNext)
          .map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));
        result.push({ path: decoded, isApprox: false });
      } else {
        result.push({ path: [{ lat: current.lat, lng: current.lng }, next], isApprox: true });
      }
    }
    return result;
  }, [geometryLibrary, nodes, finalPoint]);

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

// Same light blue as COUNTER_PROPOSAL_MARKER_ICON below — this app's established color for "an
// admin suggested/added this, it's not committed route data yet," reused here for the one
// numbered marker that's a not-yet-saved insert rather than one of the route's real stops.
export const NEW_STOP_BADGE_COLOR = "#4EA1F7";

export function numberedMarkerIcon(n: number, color: string = "#FFC531"): google.maps.Icon {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">' +
    `<circle cx="14" cy="14" r="12" fill="${color}" stroke="#15171C" stroke-width="2"/>` +
    `<text x="14" y="18.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#15171C">${n}</text>` +
    "</svg>";
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: { width: 28, height: 28 } as google.maps.Size,
    anchor: { x: 14, y: 14 } as google.maps.Point,
  };
}

// The drag handle for every "stops in order" reorder list — RouteModal's own stop list,
// StopRequestModal's attach-to-route preview — kept here so both use the exact same grip glyph.
export function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <line x1="6" y1="3" x2="6" y2="21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 4.5 19 9 6 13.5Z" fill="currentColor" />
    </svg>
  );
}

export const SCHOOL_MARKER_ICON: google.maps.Icon = {
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<line x1="6" y1="3" x2="6" y2="22" stroke="#15171C" stroke-width="2"/>' +
        '<path d="M6 4 L20 8.5 L6 13 Z" fill="#39C689" stroke="#15171C" stroke-width="1"/>' +
        "</svg>",
    ),
  scaledSize: { width: 30, height: 30 } as google.maps.Size,
  anchor: { x: 7.5, y: 27.5 } as google.maps.Point,
};

/** A vehicle's depot (start/end point) — "stop 0" of its routes. A distinct shape and color
 *  (muted blue-gray, a house glyph) from every other marker on these maps: not a numbered stop,
 *  not the destination school, not a parent's proposed/suggested location. */
export const DEPOT_MARKER_ICON: google.maps.Icon = {
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">' +
        '<circle cx="14" cy="14" r="12" fill="#6B7280" stroke="#15171C" stroke-width="2"/>' +
        '<path d="M8 15 L14 9.5 L20 15 V19.5 A1 1 0 0 1 19 20.5 H9 A1 1 0 0 1 8 19.5 Z" fill="#F4F5F7" stroke="#15171C" stroke-width="0.75"/>' +
        "</svg>",
    ),
  scaledSize: { width: 28, height: 28 } as google.maps.Size,
  anchor: { x: 14, y: 14 } as google.maps.Point,
};

/** Calls fitBounds once, after the map instance exists, to frame every point with some padding
 *  — a plain prop on <Map> can only set an *initial* view, not react to the points changing. */
export function FitBounds({ points }: { points: google.maps.LatLngLiteral[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 56);
  }, [map, points]);

  return null;
}
