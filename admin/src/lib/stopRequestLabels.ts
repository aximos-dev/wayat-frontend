import type { Resolution, ReviewReason, StopRequest } from "./types";

export const REVIEW_REASON_LABEL: Record<ReviewReason, string> = {
  NEW_LOCATION: "Needs a new stop",
  NO_ROUTE_SERVES_STOP: "No bus serves this stop",
  ROUTE_FULL: "Bus full",
  NO_ROUTE_AVAILABLE: "No route with room",
  REVERTED_BY_ADMIN: "Taken back for review",
  DETOUR_TOO_LONG: "Too far from every bus",
};

/** Admin-facing explanation shown in the review modal — what the system already checked, so the
 *  admin knows why this one landed on their desk instead of resolving itself. */
export const REVIEW_REASON_DETAIL: Record<ReviewReason, string> = {
  NEW_LOCATION: "No stop a bus already serves is within 500 m of this pin, so it would need a new stop added to a route.",
  NO_ROUTE_SERVES_STOP: "This stop exists, but no route currently stops here.",
  ROUTE_FULL: "Every bus serving this stop is out of both normal and grace seats.",
  NO_ROUTE_AVAILABLE: "No route has room for another rider and an editable stop order to add this to.",
  REVERTED_BY_ADMIN: "This was approved automatically, then taken back for manual review.",
  DETOUR_TOO_LONG:
    "Nothing is within this child's walking limit, and the cheapest detour would add more than 4 minutes to a bus (or push its ride past 75 minutes). If nearby families ask too, a shared stop is approved automatically.",
};

export const RESOLUTION_LABEL: Record<Resolution, string> = {
  EXISTING_STOP_REQUESTED: "Picked stop",
  WALK_EXISTING_STOP: "Walks to stop",
  WALK_NEW_STOP: "New stop on bus road",
  DETOUR_STOP: "Detour stop",
  GROUP_DETOUR_STOP: "Shared detour stop",
};

export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m <= 0 ? "under a minute" : `${m} min`;
}

/** One-line summary of what an auto-approval cost: walk for the child, detour for the bus. */
export function resolutionSummary(r: StopRequest): string | null {
  const parts: string[] = [];
  if (r.walkDistanceM != null) parts.push(r.walkDistanceM < 50 ? "by the home" : `${r.walkDistanceM} m walk`);
  if (r.detourS != null && (r.resolution === "DETOUR_STOP" || r.resolution === "GROUP_DETOUR_STOP")) {
    parts.push(`+${formatMinutes(r.detourS)} for the bus`);
  }
  if (r.groupSize != null) parts.push(`${r.groupSize} families`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
