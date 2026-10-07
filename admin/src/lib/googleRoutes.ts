// Client-side mirror of the backend's routing/GoogleRoutesClient.kt — same Routes API endpoint,
// same field mask, same request shape. Used only for the live edit-preview map
// (RouteStopsPreviewMap), where there's no saved route yet to read a stored polyline from. The
// backend remains the source of truth for what's actually persisted: this is a live preview, not
// a replacement for the one-call-per-leg-at-save-time computation RouteService does.

export interface RoadLeg {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string | null;
}

export async function fetchRoadLeg(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  apiKey: string,
): Promise<RoadLeg | null> {
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "DRIVE",
      }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const route = data?.routes?.[0];
    const distanceMeters: number | undefined = route?.distanceMeters;
    const durationSeconds = route?.duration ? Number(String(route.duration).replace("s", "")) : undefined;
    if (distanceMeters == null || durationSeconds == null || Number.isNaN(durationSeconds)) return null;

    return {
      distanceMeters,
      durationSeconds,
      polyline: route?.polyline?.encodedPolyline ?? null,
    };
  } catch {
    return null;
  }
}
