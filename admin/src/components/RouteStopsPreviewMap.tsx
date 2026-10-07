import { useEffect, useMemo, useState } from "react";
import { APIProvider, ColorScheme, Map as GoogleMap, Marker, Polyline, useMapsLibrary } from "@vis.gl/react-google-maps";
import { formatDistance, formatDuration } from "../lib/format";
import { fetchRoadLeg } from "../lib/googleRoutes";
import type { RoadLeg } from "../lib/googleRoutes";
import type { School, Stop } from "../lib/types";
import { APPROX_LINE_COLOR, FitBounds, FlagIcon, SCHOOL_MARKER_ICON, numberedMarkerIcon } from "./routeMapShared";

interface LegTarget {
  key: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

/** Decodes and draws whichever legs are already in `legCache` as real road paths; anything not
 *  yet fetched (or that Google couldn't resolve) stays a plain straight line. Lives inside the
 *  Map/APIProvider tree only because decoding needs the "geometry" library's `useMapsLibrary`
 *  hook — the actual fetching happens one level up, in the parent. */
function RoadPathSegments({ legTargets, legCache }: { legTargets: LegTarget[]; legCache: Map<string, RoadLeg | null> }) {
  const geometryLibrary = useMapsLibrary("geometry");

  const segments = useMemo(
    () =>
      legTargets.map((t) => {
        const cached = legCache.get(t.key);
        if (cached?.polyline && geometryLibrary) {
          const decoded = geometryLibrary.encoding
            .decodePath(cached.polyline)
            .map((latLng) => ({ lat: latLng.lat(), lng: latLng.lng() }));
          return { path: decoded, isReal: true };
        }
        return { path: [t.from, t.to], isReal: false };
      }),
    [legTargets, legCache, geometryLibrary],
  );

  return (
    <>
      {segments.map((segment, index) => (
        <Polyline
          key={index}
          path={segment.path}
          strokeColor={segment.isReal ? "#FFC531" : APPROX_LINE_COLOR}
          strokeOpacity={segment.isReal ? 0.85 : 0.9}
          strokeWeight={segment.isReal ? 3 : 2.5}
          geodesic={!segment.isReal}
        />
      ))}
    </>
  );
}

/**
 * Map preview shown as a confirmation step right before saving a route — not while stops are
 * still being added/reordered (that happens one screen earlier, with no map at all, so editing
 * never triggers any Google Routes API call). Fetches the real road path automatically once,
 * when this screen is reached ("Preview" is the step itself, not a separate click within it),
 * for whichever legs the caller's `legCache` doesn't already have — the cache lives in the
 * parent (`RouteModal`) specifically so it survives this component unmounting if the admin goes
 * back to edit and returns, instead of re-fetching legs it already knows. A leg still loading
 * (or one Google couldn't resolve) falls back to a plain straight line.
 */
export function RouteStopsPreviewMap({
  orderedStops,
  school,
  legCache,
  onLegsResolved,
}: {
  orderedStops: Stop[];
  school: School | null;
  legCache: Map<string, RoadLeg | null>;
  onLegsResolved: (results: (readonly [string, RoadLeg | null])[]) => void;
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const [isLoading, setIsLoading] = useState(false);

  const schoolPoint = school ? { lat: school.lat, lng: school.lng, name: school.name } : null;

  const allPoints = useMemo(() => {
    const points = orderedStops.map((s) => ({ lat: s.lat, lng: s.lng }));
    if (schoolPoint) points.push({ lat: schoolPoint.lat, lng: schoolPoint.lng });
    return points;
  }, [orderedStops, schoolPoint]);

  const legTargets: LegTarget[] = useMemo(() => {
    const targets: LegTarget[] = [];
    for (let i = 0; i < orderedStops.length; i++) {
      const from = orderedStops[i];
      const to = i < orderedStops.length - 1 ? orderedStops[i + 1] : schoolPoint;
      if (!to) continue;
      const toId = i < orderedStops.length - 1 ? orderedStops[i + 1].id : (school?.id ?? "school");
      targets.push({
        key: `${from.id}:${toId}`,
        from: { lat: from.lat, lng: from.lng },
        to: { lat: to.lat, lng: to.lng },
      });
    }
    return targets;
  }, [orderedStops, schoolPoint, school?.id]);

  const uncachedCount = legTargets.filter((t) => !legCache.has(t.key)).length;
  const resolvedLegs = legTargets
    .map((t) => legCache.get(t.key))
    .filter((leg): leg is RoadLeg => leg != null);
  const totalKnownM = resolvedLegs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
  const totalKnownS = resolvedLegs.reduce((sum, leg) => sum + leg.durationSeconds, 0);
  const isPartial = resolvedLegs.length < legTargets.length;

  async function fetchMissingLegs() {
    if (!apiKey) return;
    const missing = legTargets.filter((t) => !legCache.has(t.key));
    if (missing.length === 0) return;
    setIsLoading(true);
    try {
      const results = await Promise.all(
        missing.map(async (t) => [t.key, await fetchRoadLeg(t.from, t.to, apiKey)] as const),
      );
      onLegsResolved(results);
    } finally {
      setIsLoading(false);
    }
  }

  // Runs once when this confirmation screen is reached — this component only ever mounts here,
  // never during editing, so this is the one and only place the live Routes API call happens.
  useEffect(() => {
    fetchMissingLegs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!apiKey) {
    return (
      <p className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
        Google Maps API key missing — set VITE_GOOGLE_MAPS_API_KEY in .env.development.local.
      </p>
    );
  }

  if (allPoints.length === 0) {
    return (
      <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-4 text-center">
        <span className="text-sm text-text-muted">No stops to preview.</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="relative h-[18rem] w-full overflow-hidden rounded-md border border-border">
        <div
          className={
            "h-full w-full transition-[filter] duration-200 " + (isLoading ? "blur-[2px]" : "")
          }
        >
          <APIProvider apiKey={apiKey} libraries={["geometry"]}>
            <GoogleMap
              defaultCenter={allPoints[0]}
              defaultZoom={12}
              disableDefaultUI
              clickableIcons={false}
              colorScheme={ColorScheme.DARK}
            >
              <FitBounds points={allPoints} />
              <RoadPathSegments legTargets={legTargets} legCache={legCache} />
              {orderedStops.map((stop, index) => (
                <Marker key={stop.id} position={{ lat: stop.lat, lng: stop.lng }} icon={numberedMarkerIcon(index + 1)} />
              ))}
              {schoolPoint && (
                <Marker position={{ lat: schoolPoint.lat, lng: schoolPoint.lng }} icon={SCHOOL_MARKER_ICON} />
              )}
            </GoogleMap>
          </APIProvider>
        </div>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-base/20">
            <div className="flex items-center gap-2 rounded-full border border-border bg-bg-surface/95 px-3 py-1.5 shadow-lg">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
              <span className="text-xs text-text-muted">Calculating road path…</span>
            </div>
          </div>
        )}
      </div>

      {!isLoading && resolvedLegs.length > 0 && (
        <p
          className="text-sm text-text-primary"
          title={isPartial ? `${resolvedLegs.length} of ${legTargets.length} legs known` : undefined}
        >
          Total: {formatDistance(totalKnownM)} · {formatDuration(totalKnownS)}
          {isPartial && <span className="text-warning"> *</span>}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-accent" /> Real road path
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-text-muted" /> Straight-line estimate
          </span>
        </p>
        {uncachedCount > 0 && !isLoading && (
          <button
            type="button"
            onClick={fetchMissingLegs}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent"
          >
            Retry ({uncachedCount} leg{uncachedCount === 1 ? "" : "s"})
          </button>
        )}
      </div>

      {!schoolPoint && (
        <p className="flex items-start gap-1.5 text-xs text-text-muted">
          <FlagIcon className="mt-0.5 h-3 w-3 shrink-0 text-success" />
          No destination school is set up for this tenant yet.
        </p>
      )}
    </div>
  );
}
