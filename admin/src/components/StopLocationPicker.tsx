import { useEffect, useRef, useState } from "react";
import { APIProvider, Circle, ColorScheme, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import type { MapMouseEvent } from "@vis.gl/react-google-maps";

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

interface StopLocationPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  /** When set, draws a translucent circle of this radius (meters) around the pin so the admin
   *  can see the actual geofence, not just the point. */
  geofenceM?: number;
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

export function StopLocationPicker({ lat, lng, onChange, geofenceM }: StopLocationPickerProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral>(
    lat !== null && lng !== null ? { lat, lng } : DEFAULT_CENTER,
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
    <APIProvider apiKey={apiKey} libraries={["places"]}>
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
      </div>
    </APIProvider>
  );
}
