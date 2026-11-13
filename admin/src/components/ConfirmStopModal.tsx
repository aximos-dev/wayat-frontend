import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useConfirmStop, useRevertAutoApproval } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, Route, School, Stop, StopRequest } from "../lib/types";
import { Modal } from "./Modal";
import type { StopLocationPickerContextMarker } from "./StopLocationPicker";
import { StopLocationPicker } from "./StopLocationPicker";

/**
 * The admin's quick check of a stop the system created on a bus's existing road. The system
 * can't tell a safe kerb from a flyover or the far side of a divided road, so a person looks
 * once: keep or adjust the name and pin, then confirm. Or, if the spot can't work at all, undo
 * the approval that created it — which takes the stop back off the route and puts the request in
 * Needs review.
 */
export function ConfirmStopModal({
  tenantId,
  stop,
  route,
  allStops,
  school,
  request,
  onClose,
}: {
  tenantId: string;
  stop: Stop;
  /** The route this stop was added to (null only if it's somehow on none). */
  route: Route | null;
  allStops: Stop[];
  school: School | null;
  /** The auto-approved request that created this stop, if still known. */
  request: StopRequest | null;
  onClose: () => void;
}) {
  const confirm = useConfirmStop(tenantId);
  const revert = useRevertAutoApproval(tenantId);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState(stop.name);
  const [lat, setLat] = useState(stop.lat);
  const [lng, setLng] = useState(stop.lng);

  // The route's other stops (and the road between them) for context, so the admin can see where
  // the bus actually drives while adjusting the pin. This stop itself is left out — it's the pin.
  const contextMarkers: StopLocationPickerContextMarker[] = useMemo(
    () =>
      (route?.stops ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((rs, i): StopLocationPickerContextMarker | null => {
          if (rs.stopId === stop.id) return null;
          const s = allStops.find((x) => x.id === rs.stopId);
          return s ? { lat: s.lat, lng: s.lng, label: s.name, number: i + 1, roadPolylineToNext: rs.roadPolylineToNext } : null;
        })
        .filter((m): m is StopLocationPickerContextMarker => m != null),
    [route, allStops, stop.id],
  );
  const position = route?.stops.find((rs) => rs.stopId === stop.id)?.position;

  function apiError(err: unknown) {
    showError(isAxiosError<ApiError>(err) && err.response?.data?.message ? err.response.data.message : "Something went wrong.");
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    try {
      await confirm.mutateAsync({ stopId: stop.id, request: { name: name.trim(), lat, lng } });
      showSuccess(`${name.trim()} confirmed`);
      onClose();
    } catch (err) {
      apiError(err);
    }
  }

  async function handleRemove() {
    if (!request) return;
    try {
      await revert.mutateAsync(request.id);
      showSuccess(`Stop removed from ${route?.name ?? "the route"} — ${request.childName}'s request is in Needs review`);
      onClose();
    } catch (err) {
      apiError(err);
    }
  }

  const busy = confirm.isPending || revert.isPending;

  return (
    <Modal maxWidthClassName="max-w-2xl">
      <h2 className="text-lg font-semibold text-text-primary">Check new stop</h2>
      <p className="mt-1 text-sm text-text-muted">
        Added automatically to <span className="text-text-primary">{route?.name ?? "a route"}</span>
        {position != null && <> as stop #{position + 1}</>}, on the road the bus already drives
        {request && (
          <>
            {" "}— for <span className="text-text-primary">{request.childName}</span>
            {request.snappedDistanceM != null && <>, {Math.round(request.snappedDistanceM)} m from their home pin</>}
          </>
        )}
        . Make sure it's a safe spot to stop (not a flyover, signal, or the far side of a divided road), and give it a
        name drivers will recognise.
      </p>

      <form onSubmit={handleConfirm} className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Stop name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
        <StopLocationPicker
          lat={lat}
          lng={lng}
          onChange={(newLat, newLng) => {
            setLat(newLat);
            setLng(newLng);
          }}
          geofenceM={stop.geofenceM}
          contextMarkers={contextMarkers}
          contextLabel={route ? `${route.name}'s other stops, in run order` : undefined}
          contextFinalPoint={school ? { lat: school.lat, lng: school.lng } : null}
        />

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-4">
          {request ? (
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={busy}
              className="rounded-md border border-border px-4 py-2 text-sm text-text-primary transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
            >
              {revert.isPending ? "Removing…" : "Can't stop here — remove & review"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-text-primary">
              Later
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
            >
              {confirm.isPending ? "Saving…" : "Confirm stop"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
