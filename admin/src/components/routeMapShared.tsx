import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

// Shared pieces between RouteMapModal (saved-route preview) and RouteStopsPreviewMap (live
// preview while adding/editing a route) — kept in one place so the map vocabulary (marker
// shapes, colors) stays identical between "what you're building" and "what you saved".

// A light, clearly-visible gray — the muted text color (#8A8F99) that works fine for UI text
// turned out to be nearly invisible as a thin map line against this dark theme's varied terrain
// colors, so this is brighter and more saturated than you'd use for text.
export const APPROX_LINE_COLOR = "#D7DAE0";

export function numberedMarkerIcon(n: number): google.maps.Icon {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">' +
    '<circle cx="14" cy="14" r="12" fill="#FFC531" stroke="#15171C" stroke-width="2"/>' +
    `<text x="14" y="18.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#15171C">${n}</text>` +
    "</svg>";
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: { width: 28, height: 28 } as google.maps.Size,
    anchor: { x: 14, y: 14 } as google.maps.Point,
  };
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
