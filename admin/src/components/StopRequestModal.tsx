import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { isAxiosError } from "axios";
import {
  useApproveStopRequest,
  useCounterProposeStopRequest,
  useRejectStopRequest,
  useRoutes,
  useRevertAutoApproval,
  useSchool,
  useStops,
  useWithdrawCounterProposal,
} from "../lib/queries";
import { RESOLUTION_LABEL, resolutionSummary, REVIEW_REASON_DETAIL, REVIEW_REASON_LABEL } from "../lib/stopRequestLabels";
import { useToast } from "../lib/ToastContext";
import type { ApiError, NearbyRouteOption, StopRequest } from "../lib/types";
import { Modal } from "./Modal";
import { GripIcon } from "./routeMapShared";
import type { StopLocationPickerContextMarker } from "./StopLocationPicker";
import { StopLocationPicker } from "./StopLocationPicker";
import { StopRequestMapPreview } from "./StopRequestMapPreview";
import { InfoIcon, Tooltip } from "./Tooltip";

/** One slot in the route order the admin is previewing while attaching a NEW_STOP approval —
 *  either one of the route's existing stops, or the not-yet-created proposed stop ("pending"),
 *  which can only ever appear once. Kept as a single ordered array (rather than a separate
 *  "existing order" + "insert index") so the ▲▼ controls below can move the pending stop the
 *  same way they move any other row. */
type OrderEntry = { kind: "existing"; stopId: string; stopName: string } | { kind: "pending" };

/** `insertAt` places the pending stop at that slot (clamped) — used to start from the backend's
 *  precomputed least-detour position when the admin is looking at the suggested route; otherwise
 *  it goes last, as before. */
function buildInitialOrder(
  previewRoute: { stops: { stopId: string; stopName: string; position: number }[] } | undefined,
  insertAt?: number | null,
): OrderEntry[] {
  const existing: OrderEntry[] = previewRoute
    ? previewRoute.stops
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ kind: "existing", stopId: s.stopId, stopName: s.stopName }))
    : [];
  const at = insertAt == null ? existing.length : Math.max(0, Math.min(insertAt, existing.length));
  return [...existing.slice(0, at), { kind: "pending" }, ...existing.slice(at)];
}

function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m <= 0 ? "under a minute" : `${m} min`;
}

// Mirrors the backend's StopRequestService.DEFAULT_GRACE_SEAT_NOTE exactly — shown as the
// prefilled, still-editable note the moment the admin opts into a grace seat, so what's on
// screen always matches what the backend would fill in anyway if the note were left blank.
const DEFAULT_GRACE_SEAT_NOTE =
  "Approved above normal seating capacity using a grace seat — your child may need to stand for this ride.";

function handleApiError(err: unknown, showError: (msg: string) => void) {
  if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
    showError(err.response.data.message);
  } else {
    showError("Something went wrong.");
  }
}

function formatDistance(m: number | null): string {
  if (m == null) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km away` : `${Math.round(m)} m away`;
}

function NearbyRouteRow({
  option,
  isSelected,
  onSelect,
}: {
  option: NearbyRouteOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isFull = option.availableSeats <= 0;
  const isLow = !isFull && option.availableSeats <= 2;
  const hasGraceRoom = isFull && option.graceAvailable > 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "flex items-center gap-3 rounded-md bg-bg-surface px-3 py-2.5 text-left transition-colors " +
        (isSelected ? "ring-1 ring-accent" : "hover:bg-bg-base")
      }
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{option.routeName}</p>
        <p className="text-xs text-text-muted">
          {option.vehicleRegNo} · {option.vehicleTypeName}
          {option.distanceFromProposedM != null && ` · ${formatDistance(option.distanceFromProposedM)}`}
          {option.hasRideHistory && " · has ride history"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={
            "rounded-full px-2.5 py-1 text-xs font-medium " +
            (isFull ? "bg-danger-bg text-danger" : isLow ? "bg-warning-bg text-warning" : "bg-success-bg text-success")
          }
        >
          {isFull ? "No seats free" : `${option.availableSeats} seat${option.availableSeats === 1 ? "" : "s"} free`}
        </span>
        {hasGraceRoom && (
          <span className="rounded-full bg-warning-bg px-2.5 py-0.5 text-xs font-medium text-warning">
            +{option.graceAvailable} grace (standing)
          </span>
        )}
      </div>
    </button>
  );
}

/** The drag-or-▲▼-to-reorder list shared by the Approve tab's "attach to route now" and the
 *  Suggest tab's "where would this stop sit" — both are the exact same interaction (place one
 *  pending entry among a route's real current stops), just over a different `entries`/`onChange`
 *  pair and a different label for the pending row, so this is the one implementation of it. */
function OrderEntryList({
  entries,
  onChange,
  pendingLabel,
}: {
  entries: OrderEntry[];
  onChange: (next: OrderEntry[]) => void;
  pendingLabel: string;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function moveEntry(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    if (draggedIndex !== null && index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(index: number) {
    if (draggedIndex !== null && draggedIndex !== index) {
      const next = [...entries];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(index, 0, moved);
      onChange(next);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-xs text-text-muted">
        Drag a card by its handle to place the proposed stop, or use the ▲▼ buttons — this is the order it will run
        in.
      </p>
      {entries.map((entry, index) => (
        <div
          key={entry.kind === "pending" ? "pending" : entry.stopId}
          draggable
          onDragStart={() => setDraggedIndex(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={() => handleDrop(index)}
          onDragEnd={() => {
            setDraggedIndex(null);
            setDragOverIndex(null);
          }}
          className={
            "flex items-center gap-3 rounded-md border-t-2 bg-bg-surface px-3 py-2 transition-all duration-150 " +
            (entry.kind === "pending" ? "bg-accent-bg" : "") +
            (draggedIndex === index ? " opacity-40" : "") +
            (dragOverIndex === index && draggedIndex !== null && draggedIndex !== index ? " border-accent" : " border-transparent")
          }
        >
          <span className="cursor-grab text-text-muted active:cursor-grabbing" title="Drag to reorder">
            <GripIcon className="h-4 w-4" />
          </span>
          <span
            className={
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
              (entry.kind === "pending" ? "bg-accent text-bg-base" : "bg-accent-bg text-accent-muted")
            }
          >
            {index + 1}
          </span>
          <span className="flex-1 text-sm text-text-primary">{entry.kind === "pending" ? pendingLabel : entry.stopName}</span>
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => moveEntry(index, -1)}
              disabled={index === 0}
              aria-label="Move up"
              className="leading-none text-text-muted hover:text-text-primary disabled:opacity-25 disabled:hover:text-text-muted"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => moveEntry(index, 1)}
              disabled={index === entries.length - 1}
              aria-label="Move down"
              className="leading-none text-text-muted hover:text-text-primary disabled:opacity-25 disabled:hover:text-text-muted"
            >
              ▼
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StopRequestModal({
  tenantId,
  stopRequest,
  onClose,
}: {
  tenantId: string;
  stopRequest: StopRequest;
  onClose: () => void;
}) {
  const approve = useApproveStopRequest(tenantId);
  const reject = useRejectStopRequest(tenantId);
  const counterPropose = useCounterProposeStopRequest(tenantId);
  const withdrawCounterProposal = useWithdrawCounterProposal(tenantId);
  const revertAutoApproval = useRevertAutoApproval(tenantId);
  const stops = useStops(tenantId);
  const routes = useRoutes(tenantId);
  const school = useSchool(tenantId);
  const { showSuccess, showError } = useToast();

  // Two clearly separate stages for a PENDING review: first compare/pick which route this
  // request is being assessed against (map + nearby-routes list), then decide what to do about
  // it. Splitting these into their own steps — rather than route comparison sitting permanently
  // above an ever-growing pile of decision panels — keeps "where does this fit" and "what am I
  // doing about it" from blurring into one screen.
  type Step = "route" | "decide";
  const [step, setStep] = useState<Step>("route");
  // The three mutually-exclusive things a PENDING request's review can end in — shown as tabs
  // instead of a pile of independently-toggled panels, so "what am I about to do" is always one
  // clear choice instead of several maybe-combined ones. Grace-seat and attach-to-route stay
  // nested *inside* the Approve tab below — they're options on approving, not separate actions.
  type DecisionTab = "approve" | "suggest" | "reject";
  const [decisionTab, setDecisionTab] = useState<DecisionTab>("approve");
  // Whether the Approve/Suggest tab is showing its editable form or a final read-only preview —
  // the actual commit button only ever lives on the preview, so nothing is sent without the
  // admin having seen exactly what they're about to send first.
  const [previewing, setPreviewing] = useState(false);
  const [approveNote, setApproveNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  // NEW_STOP only: admin suggesting a different location than what the parent proposed, e.g.
  // their pin landed somewhere off-road or awkward for the bus — see counterPropose below.
  const [counterName, setCounterName] = useState(stopRequest.proposedName ?? "");
  const [counterLat, setCounterLat] = useState<number | null>(stopRequest.proposedLat);
  const [counterLng, setCounterLng] = useState<number | null>(stopRequest.proposedLng);
  const [counterNote, setCounterNote] = useState("");
  // Opt-in to approving into one of the selected route's grace (standing) seats — only offered
  // once that route is actually full, see `graceEligible` below.
  const [useGraceSeat, setUseGraceSeat] = useState(false);

  // Which candidate route the map/order preview below is comparing against — defaults to the
  // backend's precomputed least-detour suggestion when there is one, else the nearest route
  // (nearbyRoutes is already sorted by distance), switchable either way.
  const initialRouteId = stopRequest.suggestedRouteId ?? stopRequest.nearbyRoutes[0]?.routeId ?? null;
  const initialRouteOption = stopRequest.nearbyRoutes.find((r) => r.routeId === initialRouteId) ?? null;
  const [previewRouteId, setPreviewRouteId] = useState<string | null>(initialRouteId);
  // NEW_STOP only: whether to attach the approved stop to `previewRouteId`'s run order right
  // now, and if so, in what order — see OrderEntry above. Defaults to true (reset below
  // whenever `previewRouteId` changes — see `routeCanAttach`) because leaving it off by default
  // silently produces a stop nobody's bus ever visits: approving just creates the Stop and
  // assigns the child to it, nothing routes the bus past it until someone attaches it from here
  // or the Routes tab later. The admin can still opt out for a deliberate "add it myself later."
  const [attachToRoute, setAttachToRoute] = useState(
    stopRequest.type === "NEW_STOP" && initialRouteId != null && !initialRouteOption?.hasRideHistory,
  );
  const [orderEntries, setOrderEntries] = useState<OrderEntry[]>([]);
  // Suggest tab's own copy of the same attach-and-order decision — kept separate from the
  // Approve tab's `attachToRoute`/`orderEntries` since they're different tabs representing
  // different outcomes (one commits now, the other just suggests and waits on the parent), but
  // the interaction and backing OrderEntry shape are identical (see OrderEntryList above).
  const [suggestAttachToRoute, setSuggestAttachToRoute] = useState(false);
  const [suggestOrderEntries, setSuggestOrderEntries] = useState<OrderEntry[]>([]);

  const isPending = stopRequest.status === "PENDING";
  const isCounterProposed = stopRequest.status === "COUNTER_PROPOSED";
  const isResolved = stopRequest.status === "APPROVED" || stopRequest.status === "REJECTED";
  const previewRoute = routes.data?.find((r) => r.id === previewRouteId) ?? null;
  const previewRouteOption = stopRequest.nearbyRoutes.find((r) => r.routeId === previewRouteId) ?? null;
  const graceEligible = previewRouteOption != null && previewRouteOption.availableSeats <= 0 && previewRouteOption.graceAvailable > 0;
  // Whether there's actually a route `attachToRoute`/`suggestAttachToRoute` could attach to —
  // false when no comparison route is selected at all, or the selected one's order can no
  // longer be changed (real ride history). Both tabs' checkboxes get disabled together with
  // this, since the underlying constraint (RouteService.addStopToRoute's own rule) is the same.
  const routeCanAttach = stopRequest.type === "NEW_STOP" && previewRouteId != null && !previewRouteOption?.hasRideHistory;

  const schoolPoint = school.data ? { lat: school.data.lat, lng: school.data.lng } : null;

  // The selected route's stops, as context pins for the "suggest alternate" location picker —
  // without these the admin would be dragging a pin on an otherwise-empty map with no way to see
  // where the candidate route actually runs (or drives, now that `roadPolylineToNext` is passed
  // through too — see StopLocationPicker's `contextMarkers`/`contextFinalPoint`). Memoized so the
  // array reference only changes when the underlying route/stops actually do — StopLocationPicker
  // only re-fits its map when this reference changes, so a new array every render (from a plain
  // inline computation) would have silently re-fit — and re-zoomed out — on every unrelated
  // keystroke in the form below it.
  const suggestContextMarkers: StopLocationPickerContextMarker[] = useMemo(
    () =>
      (previewRoute?.stops ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((rs, i): StopLocationPickerContextMarker | null => {
          const stop = stops.data?.find((s) => s.id === rs.stopId);
          return stop
            ? { lat: stop.lat, lng: stop.lng, label: stop.name, number: i + 1, roadPolylineToNext: rs.roadPolylineToNext }
            : null;
        })
        .filter((m): m is StopLocationPickerContextMarker => m != null),
    [previewRoute, stops.data],
  );

  // Fed to StopRequestMapPreview on the Suggest tab's preview screen — the real `stopRequest`
  // doesn't have the counter-proposal yet (nothing's been sent), so this stands in for it:
  // substituting the suggested spot into `proposedLat`/`proposedLng` (rather than only
  // `counterProposed*`) is what makes StopRequestMapPreview treat it as the thing being
  // attached/inserted — same target+insertAt machinery the Approve tab's preview uses, just
  // pointed at the suggested location instead of the parent's original one.
  const suggestPreviewRequest: StopRequest = {
    ...stopRequest,
    proposedName: counterName || stopRequest.proposedName,
    proposedLat: counterLat,
    proposedLng: counterLng,
    counterProposedName: null,
    counterProposedLat: null,
    counterProposedLng: null,
  };

  // Switching which route is being reviewed invalidates any grace-seat opt-in and any
  // attach-to-route choice from the previous one — both are properties of a specific route, not
  // free-floating choices that should silently carry over to whichever route happens to be
  // selected by the time the admin hits Approve/Suggest. Re-defaults attach back to "on" (rather
  // than just clearing it) for the same "don't silently create an orphan stop" reason the
  // initial state above does. (orderEntries/suggestOrderEntries don't need resetting here: the
  // effects below already reseed them whenever `attachToRoute`/`suggestAttachToRoute` is — or
  // becomes — true.)
  useEffect(() => {
    setUseGraceSeat(false);
    const canAttach = stopRequest.type === "NEW_STOP" && previewRouteId != null && !previewRouteOption?.hasRideHistory;
    setAttachToRoute(canAttach);
    setSuggestAttachToRoute(canAttach);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRouteId]);

  // A suggested location picked while comparing against one route has no guaranteed relevance
  // to a different one — without this, switching routes left the pin exactly where it was,
  // silently producing a suggestion that looked like it belonged to whichever route was
  // selected when the admin reaches the final preview, not the one they actually picked it
  // against. Resets back to the parent's own original proposal, same as the initial state.
  useEffect(() => {
    setCounterName(stopRequest.proposedName ?? "");
    setCounterLat(stopRequest.proposedLat);
    setCounterLng(stopRequest.proposedLng);
    setCounterNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRouteId]);

  // Leaving the decision tab (or going back to re-pick a route) always drops back to the
  // editable form rather than leaving a stale preview showing — switching routes, in particular,
  // can change which attach/grace options even make sense.
  useEffect(() => {
    setPreviewing(false);
  }, [decisionTab, previewRouteId]);

  function handleToggleGraceSeat(checked: boolean) {
    setUseGraceSeat(checked);
    // Prefills the note so what's on screen matches what gets sent — but never overwrites text
    // the admin already typed themselves.
    if (checked && !approveNote.trim()) {
      setApproveNote(DEFAULT_GRACE_SEAT_NOTE);
    }
  }

  // Reseed the reorder list whenever the admin turns attaching on, or switches which route
  // they're attaching to — otherwise flipping routes would leave stale stop ids from the
  // previous route mixed into the list.
  // On the suggested route, the new stop starts in the backend's least-detour slot rather than
  // last — the admin can still drag it anywhere.
  const suggestedSlot = previewRouteId != null && previewRouteId === stopRequest.suggestedRouteId
    ? stopRequest.suggestedInsertPosition
    : null;

  useEffect(() => {
    if (attachToRoute) {
      setOrderEntries(buildInitialOrder(previewRoute ?? undefined, suggestedSlot));
    }
  }, [attachToRoute, previewRoute, suggestedSlot]);

  // Same reseed, for the Suggest tab's own copy.
  useEffect(() => {
    if (suggestAttachToRoute) {
      setSuggestOrderEntries(buildInitialOrder(previewRoute ?? undefined, suggestedSlot));
    }
  }, [suggestAttachToRoute, previewRoute, suggestedSlot]);

  // -1 (not null) happens for one render right after switching `previewRouteId` while attaching
  // — `orderEntries` is still seeded for the previous route and briefly has no "pending" entry,
  // until the reorder-seeding effect above catches up. Treat that the same as "not attaching
  // yet" rather than handing a bogus index downstream.
  const foundInsertAt = attachToRoute ? orderEntries.findIndex((e) => e.kind === "pending") : -1;
  const insertAt = foundInsertAt >= 0 ? foundInsertAt : null;

  const foundSuggestInsertAt = suggestAttachToRoute ? suggestOrderEntries.findIndex((e) => e.kind === "pending") : -1;
  const suggestInsertAt = foundSuggestInsertAt >= 0 ? foundSuggestInsertAt : null;

  async function handleApprove() {
    try {
      const request: Parameters<typeof approve.mutateAsync>[0]["request"] = {
        adminNote: approveNote || null,
        viaGraceSeat: graceEligible && useGraceSeat,
      };
      if (stopRequest.type === "NEW_STOP" && attachToRoute && previewRouteId && insertAt != null) {
        request.routeId = previewRouteId;
        request.existingStopIdsInOrder = orderEntries
          .filter((e): e is { kind: "existing"; stopId: string; stopName: string } => e.kind === "existing")
          .map((e) => e.stopId);
        request.insertPosition = insertAt;
      }
      await approve.mutateAsync({ id: stopRequest.id, request });
      showSuccess(`${stopRequest.childName} assigned to ${stopRequest.type === "NEW_STOP" ? stopRequest.proposedName : stopRequest.existingStopName}`);
      onClose();
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    try {
      await reject.mutateAsync({ id: stopRequest.id, request: { adminNote: rejectNote } });
      showSuccess("Request rejected");
      onClose();
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  async function handleCounterPropose(e: React.FormEvent) {
    e.preventDefault();
    if (counterLat == null || counterLng == null || !counterName.trim()) return;
    try {
      const request: Parameters<typeof counterPropose.mutateAsync>[0]["request"] = {
        counterProposedName: counterName.trim(),
        counterProposedLat: counterLat,
        counterProposedLng: counterLng,
        adminNote: counterNote || null,
      };
      if (suggestAttachToRoute && previewRouteId && suggestInsertAt != null) {
        request.routeId = previewRouteId;
        request.insertPosition = suggestInsertAt;
      }
      await counterPropose.mutateAsync({ id: stopRequest.id, request });
      showSuccess("Suggestion sent — waiting on the parent's response");
      onClose();
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  async function handleWithdrawCounterProposal() {
    try {
      await withdrawCounterProposal.mutateAsync(stopRequest.id);
      showSuccess("Suggestion withdrawn — back to pending");
      onClose();
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  async function handleRevertAutoApproval() {
    try {
      await revertAutoApproval.mutateAsync(stopRequest.id);
      showSuccess(`Undone — ${stopRequest.childName} is back on their previous stop, and this is in Needs review`);
      onClose();
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  const isBusy = approve.isPending || reject.isPending || counterPropose.isPending;

  return (
    <Modal maxWidthClassName="max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{stopRequest.childName}</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {stopRequest.className} / {stopRequest.sectionName} · {stopRequest.admissionNo}
          </p>
        </div>
        <span
          className={
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " +
            (stopRequest.status === "PENDING"
              ? "bg-neutral-bg text-neutral"
              : stopRequest.status === "COUNTER_PROPOSED"
                ? "bg-warning-bg text-warning"
                : stopRequest.status === "APPROVED"
                  ? "bg-success-bg text-success"
                  : "bg-danger-bg text-danger")
          }
        >
          {stopRequest.status === "COUNTER_PROPOSED" ? "AWAITING PARENT" : stopRequest.status}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-md bg-bg-base px-3 py-2.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Parent</span>
          <p className="mt-0.5 text-sm text-text-primary">{stopRequest.parentName}</p>
          <p className="text-xs text-text-muted">{stopRequest.parentPhone}</p>
        </div>
        <div className="rounded-md bg-bg-base px-3 py-2.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Requested</span>
          {stopRequest.type === "EXISTING_STOP" ? (
            <>
              <p className="mt-0.5 text-sm text-text-primary">{stopRequest.existingStopName}</p>
              <p className="text-xs text-text-muted">Existing stop</p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-sm text-text-primary">{stopRequest.proposedName}</p>
              <p className="text-xs text-text-muted">
                New stop · {stopRequest.proposedLat?.toFixed(5)}, {stopRequest.proposedLng?.toFixed(5)}
              </p>
            </>
          )}
        </div>
      </div>

      {isPending && step === "route" && stopRequest.reviewReason && (
        <div className="mt-4 rounded-md border border-border bg-bg-base px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-text-muted">
            Why this needs you · <span className="text-text-primary">{REVIEW_REASON_LABEL[stopRequest.reviewReason]}</span>
          </p>
          <p className="mt-0.5 text-sm text-text-muted">{REVIEW_REASON_DETAIL[stopRequest.reviewReason]}</p>
          {stopRequest.suggestedRouteId && stopRequest.suggestedInsertPosition != null && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-accent-bg/60 px-3 py-2">
              <p className="text-sm text-text-primary">
                Suggested: add to <span className="font-medium">{stopRequest.suggestedRouteName}</span> as stop{" "}
                <span className="font-medium">#{stopRequest.suggestedInsertPosition + 1}</span>
                <span className="text-text-muted">
                  {" "}— adds{" "}
                  {stopRequest.suggestedDetourS != null
                    ? `about ${formatMinutes(stopRequest.suggestedDetourS)}`
                    : `about ${((stopRequest.suggestedDetourM ?? 0) / 1000).toFixed(1)} km`}{" "}
                  to the run
                </span>
              </p>
              {previewRouteId !== stopRequest.suggestedRouteId && (
                <button
                  type="button"
                  onClick={() => setPreviewRouteId(stopRequest.suggestedRouteId)}
                  className="shrink-0 text-xs font-medium text-accent-muted hover:text-accent"
                >
                  Use suggestion
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {(!isPending || step === "route") && (
        <>
          <div className="mt-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">
              {stopRequest.type === "NEW_STOP" ? "Where this would be" : "Where this stop is"}
            </span>
            <div className="mt-2">
              <StopRequestMapPreview
                stopRequest={stopRequest}
                allStops={stops.data ?? []}
                previewRoute={previewRoute}
                // Always null here, even though `attachToRoute` now defaults to true (see its
                // state comment above) — this is the plain "how does this route currently run"
                // comparison map, shown before the admin has reached (or confirmed) any decision.
                // Passing the live `insertAt` through made this map jump straight to drawing the
                // attach-splice preview (the two new approximate legs bridging the target into
                // the route) the moment the modal opened, which read as a stray/broken line
                // rather than the route's real shape. The attach preview belongs only on the
                // Approve tab's own preview screen, further down.
                insertAt={null}
                school={school.data ?? null}
              />
            </div>
          </div>

          <div className="mt-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-primary">
              {stopRequest.type === "EXISTING_STOP" ? "Buses already serving this stop" : "Nearest existing routes"}
              <Tooltip
                trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
                content={
                  stopRequest.type === "EXISTING_STOP"
                    ? "Live seat count for every route that already stops here — confirm there's actually room before approving."
                    : "The closest existing routes to the proposed location, with live seat counts — a short distance with free seats is a good candidate to extend; nothing close usually means this needs a new route instead. Pick one to compare against."
                }
              />
            </span>
            <div className="mt-2 flex flex-col gap-2">
              {stopRequest.nearbyRoutes.length === 0 && (
                <p className="rounded-md bg-bg-base px-3 py-2.5 text-sm text-text-muted">
                  {stopRequest.type === "EXISTING_STOP"
                    ? "No route currently stops here."
                    : "No routes exist yet in this tenant to compare against."}
                </p>
              )}
              {stopRequest.nearbyRoutes.map((option) => (
                <NearbyRouteRow
                  key={option.routeId}
                  option={option}
                  isSelected={option.routeId === previewRouteId}
                  onSelect={() => setPreviewRouteId(option.routeId)}
                />
              ))}
            </div>
          </div>

          {isPending && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep("decide")}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
              >
                Continue to decide →
              </button>
            </div>
          )}
        </>
      )}

      {isResolved && (
        <div className="mt-4 rounded-md bg-bg-base px-3 py-2.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">
            {stopRequest.status === "APPROVED" ? (stopRequest.autoApproved ? "Approved automatically" : "Approved") : "Rejected"}
            {stopRequest.resolvedAt && ` ${new Date(stopRequest.resolvedAt).toLocaleString()}`}
          </span>
          {stopRequest.resultStopName && (
            <p className="mt-0.5 text-sm text-text-primary">
              Assigned to {stopRequest.resultStopName}
              {stopRequest.resolution && stopRequest.resolution !== "EXISTING_STOP_REQUESTED" && (
                <span className="ml-2 rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-medium text-neutral">
                  {RESOLUTION_LABEL[stopRequest.resolution]}
                  {resolutionSummary(stopRequest) && <> · {resolutionSummary(stopRequest)}</>}
                </span>
              )}
              {!stopRequest.resolution && stopRequest.snappedDistanceM != null && (
                <span className="ml-2 rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-medium text-neutral">
                  {stopRequest.autoCreatedStop ? "New stop on the bus's road" : "Nearest stop"} ·{" "}
                  {Math.round(stopRequest.snappedDistanceM)} m from their pin
                </span>
              )}
              {stopRequest.viaGraceSeat && (
                <span className="ml-2 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">
                  Grace seat (standing)
                </span>
              )}
            </p>
          )}
          {stopRequest.adminNote && <p className="mt-0.5 text-sm text-text-muted">"{stopRequest.adminNote}"</p>}
        </div>
      )}

      {isCounterProposed && (
        <div className="mt-4 rounded-md border border-warning/40 bg-warning-bg/30 px-3 py-2.5">
          <span className="text-xs uppercase tracking-wide text-warning">Waiting on the parent</span>
          <p className="mt-0.5 text-sm text-text-primary">
            Suggested <span className="font-medium">{stopRequest.counterProposedName}</span> instead of the original
            spot
          </p>
          <p className="text-xs text-text-muted">
            {stopRequest.counterProposedLat?.toFixed(5)}, {stopRequest.counterProposedLng?.toFixed(5)}
          </p>
          {stopRequest.counterProposedRouteName && (
            <p className="mt-1.5 text-sm text-text-muted">
              Will join <span className="font-medium text-text-primary">{stopRequest.counterProposedRouteName}</span>'s run as
              soon as this is accepted
            </p>
          )}
          {stopRequest.adminNote && <p className="mt-1.5 text-sm text-text-muted">"{stopRequest.adminNote}"</p>}
          <p className="mt-2 text-xs text-text-muted">
            No parent app exists yet to deliver this or collect their answer — this is recorded and ready for one.
            Until then, withdraw it to go back to reviewing the original request yourself.
          </p>
          <div className="mt-3 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void handleWithdrawCounterProposal()}
              disabled={withdrawCounterProposal.isPending}
              className="rounded-md border border-warning px-4 py-2 text-sm font-medium text-warning disabled:opacity-50"
            >
              {withdrawCounterProposal.isPending ? "Withdrawing…" : "Withdraw suggestion"}
            </button>
          </div>
        </div>
      )}

      {isPending && step === "decide" && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-md bg-bg-base px-3 py-2 text-sm">
            <span className="text-text-muted">
              Comparing against{" "}
              <span className="font-medium text-text-primary">{previewRouteOption?.routeName ?? "no route"}</span>
            </span>
            <button
              type="button"
              onClick={() => setStep("route")}
              className="shrink-0 text-xs font-medium text-accent-muted hover:text-accent"
            >
              ← Change route
            </button>
          </div>

          <div className="flex gap-2">
            {([
              ["approve", "Approve"],
              ...(stopRequest.type === "NEW_STOP" ? [["suggest", "Suggest alternate"] as const] : []),
              ["reject", "Reject"],
            ] as const).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setDecisionTab(t)}
                disabled={isBusy}
                className={
                  "rounded-md px-3 py-1.5 text-sm disabled:opacity-50 " +
                  (decisionTab === t
                    ? t === "reject"
                      ? "bg-danger-bg text-danger"
                      : "bg-accent-bg text-accent-muted"
                    : "text-text-muted hover:text-text-primary")
                }
              >
                {label}
              </button>
            ))}
          </div>

          {decisionTab === "approve" && !previewing && (
            <div className="mt-3 flex flex-col gap-3">
              {graceEligible && (
                <div className="rounded-md border border-warning/40 bg-warning-bg/30 px-3 py-2.5">
                  <label className="flex items-start gap-2.5 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={useGraceSeat}
                      onChange={(e) => handleToggleGraceSeat(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-warning"
                    />
                    <span>
                      ⚠ <span className="font-medium">{previewRouteOption?.routeName}</span> is full — use one of its{" "}
                      <span className="font-medium text-warning">{previewRouteOption?.graceAvailable} grace</span>{" "}
                      (standing) seats?
                    </span>
                  </label>
                  <p className="mt-1.5 pl-[26px] text-xs text-warning">
                    {useGraceSeat
                      ? "The note below will tell the parent their child may need to stand — edit it to say it differently."
                      : "Leave this unchecked to pick a different route instead, or approve anyway without attaching to this one."}
                  </p>
                </div>
              )}

              {stopRequest.type === "NEW_STOP" && previewRouteId && (
                <div className="rounded-md bg-bg-base px-3 py-2.5">
                  <label className="flex items-center gap-2.5 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={attachToRoute}
                      disabled={!routeCanAttach}
                      onChange={(e) => setAttachToRoute(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    Add this stop to <span className="font-medium">{previewRouteOption?.routeName}</span>'s run now
                  </label>
                  {previewRouteOption?.hasRideHistory && (
                    <p className="mt-1.5 text-xs text-warning">
                      This route already has ride history — its stop order can't be changed. Pick a different route,
                      or approve without attaching and add it from the Routes tab later.
                    </p>
                  )}
                  {!attachToRoute && routeCanAttach && (
                    <p className="mt-1.5 text-xs text-warning">
                      ⚠ Approving without attaching creates the stop, but no bus run will visit it until it's added to a
                      route here or from the Routes tab.
                    </p>
                  )}
                  {attachToRoute && !previewRouteOption?.hasRideHistory && (
                    <OrderEntryList
                      entries={orderEntries}
                      onChange={setOrderEntries}
                      pendingLabel={`${stopRequest.proposedName} (new)`}
                    />
                  )}
                </div>
              )}
              {stopRequest.type === "NEW_STOP" && !previewRouteId && (
                <p className="rounded-md border border-warning/40 bg-warning-bg/30 px-3 py-2.5 text-xs text-warning">
                  ⚠ No route selected to attach this stop to — approving will create the stop, but no bus run will
                  visit it until it's added to a route from the Routes tab later.
                </p>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-text-muted">Note (optional, shown on approval)</span>
                <input
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  placeholder="e.g. Confirmed seat available"
                  className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewing(true)}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
                >
                  Continue to preview →
                </button>
              </div>
            </div>
          )}

          {decisionTab === "approve" && previewing && (
            <div className="mt-3 flex flex-col gap-3">
              <StopRequestMapPreview
                stopRequest={stopRequest}
                allStops={stops.data ?? []}
                previewRoute={previewRoute}
                insertAt={insertAt}
                school={school.data ?? null}
              />
              <div className="flex flex-col gap-1 rounded-md bg-bg-base px-3 py-2.5 text-sm">
                <p className="text-text-primary">
                  Assign <span className="font-medium">{stopRequest.childName}</span> to{" "}
                  <span className="font-medium">
                    {stopRequest.type === "NEW_STOP" ? stopRequest.proposedName : stopRequest.existingStopName}
                  </span>
                </p>
                {useGraceSeat && graceEligible && (
                  <p className="text-warning">Using a grace (standing) seat on {previewRouteOption?.routeName}</p>
                )}
                {attachToRoute && (
                  <p className="text-text-muted">Attaching to {previewRouteOption?.routeName}'s run, as ordered above</p>
                )}
                {approveNote && <p className="text-text-muted">Note: "{approveNote}"</p>}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewing(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleApprove()}
                  disabled={isBusy}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
                >
                  {approve.isPending ? "Approving…" : "Confirm & approve"}
                </button>
              </div>
            </div>
          )}

          {decisionTab === "suggest" && !previewing && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-xs text-text-muted">
                Pick a better spot nearby — search, click the map, or drag the pin — using{" "}
                <span className="font-medium text-text-primary">{previewRouteOption?.routeName ?? "the selected route"}</span>'s
                own stops (shown below) for context.
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-text-muted">Suggested stop name</span>
                <input
                  required
                  value={counterName}
                  onChange={(e) => setCounterName(e.target.value)}
                  className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <StopLocationPicker
                lat={counterLat}
                lng={counterLng}
                onChange={(lat, lng) => {
                  setCounterLat(lat);
                  setCounterLng(lng);
                }}
                contextMarkers={suggestContextMarkers}
                contextLabel={previewRoute ? `${previewRoute.name}'s stops, in today's run order` : undefined}
                contextFinalPoint={schoolPoint}
              />

              {previewRouteId && (
                <div className="rounded-md bg-bg-base px-3 py-2.5">
                  <label className="flex items-center gap-2.5 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={suggestAttachToRoute}
                      disabled={!routeCanAttach}
                      onChange={(e) => setSuggestAttachToRoute(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    Join <span className="font-medium">{previewRouteOption?.routeName}</span>'s run as soon as this is
                    accepted
                  </label>
                  {previewRouteOption?.hasRideHistory && (
                    <p className="mt-1.5 text-xs text-warning">
                      This route already has ride history — its stop order can't be changed. Pick a different route,
                      or suggest without attaching and add it from the Routes tab once accepted.
                    </p>
                  )}
                  {!suggestAttachToRoute && routeCanAttach && (
                    <p className="mt-1.5 text-xs text-warning">
                      ⚠ Without this, accepting the suggestion creates the stop but no bus run will visit it until it's
                      added to a route later.
                    </p>
                  )}
                  {suggestAttachToRoute && !previewRouteOption?.hasRideHistory && (
                    <OrderEntryList
                      entries={suggestOrderEntries}
                      onChange={setSuggestOrderEntries}
                      pendingLabel={`${counterName || "this stop"} (suggested)`}
                    />
                  )}
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-text-muted">Note to the parent (optional)</span>
                <input
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  placeholder="e.g. This spot is easier for the bus to reach safely"
                  className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewing(true)}
                  disabled={counterLat == null || counterLng == null || !counterName.trim()}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
                >
                  Continue to preview →
                </button>
              </div>
            </div>
          )}

          {decisionTab === "suggest" && previewing && (
            <form onSubmit={handleCounterPropose} className="mt-3 flex flex-col gap-3">
              <StopRequestMapPreview
                stopRequest={suggestPreviewRequest}
                allStops={stops.data ?? []}
                previewRoute={previewRoute}
                insertAt={suggestInsertAt}
                school={school.data ?? null}
              />
              <div className="flex flex-col gap-1 rounded-md bg-bg-base px-3 py-2.5 text-sm">
                <p className="text-text-primary">
                  Suggest <span className="font-medium">{counterName}</span> instead of the original spot
                </p>
                <p className="text-text-muted">
                  {counterLat?.toFixed(5)}, {counterLng?.toFixed(5)}
                </p>
                {suggestAttachToRoute && (
                  <p className="text-text-muted">
                    Will join <span className="font-medium text-text-primary">{previewRouteOption?.routeName}</span>'s
                    run, as ordered above, the moment the parent accepts
                  </p>
                )}
                {counterNote && <p className="text-text-muted">Note to parent: "{counterNote}"</p>}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewing(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={counterPropose.isPending || counterLat == null || counterLng == null || !counterName.trim()}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
                >
                  {counterPropose.isPending ? "Sending…" : "Confirm & send suggestion"}
                </button>
              </div>
            </form>
          )}

          {decisionTab === "reject" && (
            <form onSubmit={handleReject} className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-wide text-text-muted">Reason for rejecting (required)</span>
                <input
                  required
                  autoFocus
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="e.g. Too far from any existing route"
                  className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                />
              </label>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="rounded-md bg-danger px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
                >
                  {reject.isPending ? "Rejecting…" : "Confirm reject"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isResolved && (
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">
          {stopRequest.autoApproved && (
            <button
              type="button"
              onClick={() => void handleRevertAutoApproval()}
              disabled={revertAutoApproval.isPending}
              title={`Puts ${stopRequest.childName} back on their previous stop and moves this to Needs review`}
              className="rounded-md border border-border px-4 py-2 text-sm text-text-primary transition-colors hover:border-warning hover:text-warning disabled:opacity-50"
            >
              {revertAutoApproval.isPending ? "Undoing…" : "Undo & review manually"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
          >
            Close
          </button>
        </div>
      )}
    </Modal>
  );
}
