import { useEffect, useMemo, useRef, useState } from "react";
import { APIProvider, Circle, ColorScheme, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { MapMouseEvent } from "@vis.gl/react-google-maps";
import { FitBounds, MAP_LIBRARIES, RoadPathSegments, numberedMarkerIcon } from "./routeMapShared";

// Bangalore — just a sensible default center before the admin searches or clicks anywhere.
const DEFAULT_CENTER = { lat: 12.9352, lng: 77.5623 };

// A teardrop pin in the app's accent yellow, same shape as the pin icon used elsewhere in the
// UI (see SchoolSection's PinIcon) — keeps the map marker visually consistent with the rest of
// the app instead of Google's default red. Built as a plain SVG data URI rather than an
// AdvancedMarker/Pin so it doesn't need a Google Maps "Map ID" to be configured.
const MARKER_ICON: google.maps.Icon = {
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

export interface StopLocationPickerContextMarker {
  lat: number;
  lng: number;
  label: string;
  /** Rendered as the same numbered yellow circle used everywhere else a route's stop order is
   *  shown (RouteMapModal, StopRequestMapPreview) — these are meant to BE a route's real stops,
   *  not arbitrary points, so the number is always its real position. */
  number: number;
  /** This stop's real stored road leg to the next one in `number` order (or to `contextFinalPoint`
   *  for the last one) — lets the picker draw the route as it actually drives, not just floating
   *  dots, so the admin has something real to place the new pin relative to. Omit/null falls back
   *  to a straight line for that leg. */
  roadPolylineToNext?: string | null;
}

interface StopLocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  /** When set, draws a translucent circle of this radius (meters) around the pin so the admin
   *  can see the actual geofence, not just the point. */
  geofenceM?: number;
  /** Other points worth seeing while picking — e.g. a candidate route's existing stops, so the
   *  admin can place the new pin relative to where the bus already goes instead of guessing
   *  blind on an otherwise-empty map. Purely informational: not draggable or clickable, and
   *  doesn't affect `onChange`. When present, the map frames all of them plus the pick pin
   *  instead of just centering tightly on the pin. */
  contextMarkers?: StopLocationPickerContextMarker[];
  /** One line under the map explaining what the numbered pins are, e.g. "Route 1's stops, in
   *  today's run order." Only shown when `contextMarkers` is non-empty. */
  contextLabel?: string;
  /** Where the context route's last leg goes — typically the destination school — so the drawn
   *  road path continues past the last numbered stop instead of stopping short. Safe to omit. */
  contextFinalPoint?: google.maps.LatLngLiteral | null;
}

function PlaceSearchBox({ onPlaceSelected }: { onPlaceSelected: (lat: number, lng: number) => void }) {
  const map = useMap();
  const placesLibrary = useMapsLibrary("places");
  const containerRef = useRef<HTMLDivElement>(null);
  // Keeps the effect below from depending on `onPlaceSelected` directly — that prop is a new
  // function identity on every parent re-render, which would otherwise tear down and recreate
  // the autocomplete element (losing in-progress search/selection) on every keystroke elsewhere
  // in the form.
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  useEffect(() => {
    if (!placesLibrary || !containerRef.current || !map) return;

    // The classic `Autocomplete` class is closed to new Google Cloud projects (since March
    // 2025) — this is the replacement web component, requires Places API (New).
    const autocompleteElement = new placesLibrary.PlaceAutocompleteElement();
    autocompleteElement.placeholder = "Search for a place…";
    containerRef.current.appendChild(autocompleteElement);

    async function handleSelect(e: google.maps.places.PlacePredictionSelectEvent) {
      const place = e.placePrediction.toPlace();
      await place.fetchFields({ fields: ["location"] });
      const location = place.location;
      if (!location || !map) return;
      map.panTo(location);
      map.setZoom(16);
      onPlaceSelectedRef.current(location.lat(), location.lng());
    }

    autocompleteElement.addEventListener("gmp-select", handleSelect);
    return () => {
      autocompleteElement.removeEventListener("gmp-select", handleSelect);
      autocompleteElement.remove();
    };
  }, [placesLibrary, map]);

  return <div ref={containerRef} className="w-full" />;
}

export function StopLocationPicker({
  lat,
  lng,
  onChange,
  geofenceM,
  contextMarkers = [],
  contextLabel,
  contextFinalPoint = null,
}: StopLocationPickerProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral>(
    lat !== null && lng !== null ? { lat, lng } : DEFAULT_CENTER,
  );
  // Captured once, not read live — frames context + wherever the pin started, on mount only.
  // Using the live `markerPosition` here instead would re-fit (re-zoom/pan) on every drag,
  // fighting the admin's own zoom as they try to place the pin precisely.
  const initialPositionRef = useRef(markerPosition);
  const fitPoints = useMemo(
    () =>
      contextMarkers.length > 0
        ? [...contextMarkers.map((m) => ({ lat: m.lat, lng: m.lng })), initialPositionRef.current]
        : [],
    [contextMarkers],
  );
  // Sorted by run order, not insertion order, so the drawn road path connects stops the way the
  // bus actually visits them rather than however the caller happened to list them.
  const contextRoadNodes = useMemo(
    () =>
      contextMarkers
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((m) => ({ lat: m.lat, lng: m.lng, roadPolylineToNext: m.roadPolylineToNext ?? null })),
    [contextMarkers],
  );

  function handlePick(newLat: number, newLng: number) {
    setMarkerPosition({ lat: newLat, lng: newLng });
    onChange(newLat, newLng);
  }

  function handleMapClick(e: MapMouseEvent) {
    const latLng = e.detail.latLng;
    if (!latLng) return;
    handlePick(latLng.lat, latLng.lng);
  }

  function handleMarkerDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    handlePick(e.latLng.lat(), e.latLng.lng());
  }

  if (!apiKey) {
    return (
      <p className="text-xs text-danger">
        Google Maps API key missing — set VITE_GOOGLE_MAPS_API_KEY in .env.development.local.
      </p>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={MAP_LIBRARIES}>
      <div className="flex flex-col gap-2">
        <PlaceSearchBox onPlaceSelected={handlePick} />
        <div className="h-64 w-full overflow-hidden rounded-md border border-border">
          <Map
            defaultCenter={markerPosition}
            defaultZoom={lat !== null && lng !== null ? 16 : 12}
            onClick={handleMapClick}
            disableDefaultUI
            clickableIcons={false}
            colorScheme={ColorScheme.DARK}
          >
            {fitPoints.length > 0 && <FitBounds points={fitPoints} />}
            {contextRoadNodes.length > 0 && <RoadPathSegments nodes={contextRoadNodes} finalPoint={contextFinalPoint} />}
            {contextMarkers.map((m) => (
              <Marker
                key={`${m.number}-${m.lat}-${m.lng}`}
                position={{ lat: m.lat, lng: m.lng }}
                icon={numberedMarkerIcon(m.number)}
                title={m.label}
              />
            ))}
            {geofenceM != null && geofenceM > 0 && (
              <Circle
                center={markerPosition}
                radius={geofenceM}
                strokeColor="#FFC531"
                strokeOpacity={0.7}
                strokeWeight={1.5}
                fillColor="#FFC531"
                fillOpacity={0.12}
              />
            )}
            <Marker
              position={markerPosition}
              draggable
              onDragEnd={handleMarkerDragEnd}
              icon={MARKER_ICON}
            />
          </Map>
        </div>
        <p className="text-xs text-text-muted">
          Search for a place, or click anywhere on the map, or drag the pin to the exact spot.
          {lat !== null && lng !== null && (
            <>
              {" "}
              Selected: {lat.toFixed(6)}, {lng.toFixed(6)}
              {geofenceM != null && geofenceM > 0 && <> · geofence shown as the shaded circle</>}
            </>
          )}
        </p>
        {contextMarkers.length > 0 && contextLabel && (
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-bg-base">
              #
            </span>
            {contextLabel}
          </p>
        )}
      </div>
    </APIProvider>
  );
}
