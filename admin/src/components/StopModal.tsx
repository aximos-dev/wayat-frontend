import { useState } from "react";
import { isAxiosError } from "axios";
import { useCreateStop, useUpdateStop } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, Stop } from "../lib/types";
import { Modal } from "./Modal";
import { StopLocationPicker } from "./StopLocationPicker";

const DEFAULT_GEOFENCE_M = 75;

export function StopModal({
  tenantId,
  stop,
  onClose,
}: {
  tenantId: string;
  /** Omit to create a new stop; pass an existing one to edit it. */
  stop?: Stop;
  onClose: () => void;
}) {
  const isEditing = stop != null;
  const createStop = useCreateStop();
  const updateStop = useUpdateStop(tenantId);
  const { showSuccess, showError } = useToast();

  const [name, setName] = useState(stop?.name ?? "");
  const [lat, setLat] = useState<number | null>(stop?.lat ?? null);
  const [lng, setLng] = useState<number | null>(stop?.lng ?? null);
  const [geofenceM, setGeofenceM] = useState(stop?.geofenceM ?? DEFAULT_GEOFENCE_M);
  // Collapsed by default — most stops just want the default radius. Starts expanded when
  // editing a stop whose geofence was already customized, so that value isn't hidden.
  const [showGeofence, setShowGeofence] = useState(
    stop != null && stop.geofenceM !== DEFAULT_GEOFENCE_M,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lat === null || lng === null) {
      showError("Pick a location on the map first.");
      return;
    }
    try {
      if (isEditing) {
        await updateStop.mutateAsync({ stopId: stop.id, request: { name, lat, lng, geofenceM } });
        showSuccess("Stop updated");
      } else {
        await createStop.mutateAsync({ tenantId, name, lat, lng, geofenceM });
        showSuccess("Stop added");
      }
      onClose();
    } catch (err) {
      // Surfaces the backend's own message — e.g. DUPLICATE_STOP's "within 30m of an existing
      // stop" explanation (see StopService) — rather than a generic failure.
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  const isSaving = createStop.isPending || updateStop.isPending;

  return (
    <Modal>
      <h2 className="text-lg font-semibold text-text-primary">
        {isEditing ? "Edit stop" : "Add a stop"}
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ragigudda Signal"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Location</span>
            <StopLocationPicker
              lat={lat}
              lng={lng}
              geofenceM={geofenceM}
              onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }}
            />
          </label>

          {showGeofence ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-text-muted">
                Geofence radius (meters)
              </span>
              <input
                required
                type="number"
                min={10}
                max={1000}
                value={geofenceM}
                onChange={(e) => setGeofenceM(Number(e.target.value))}
                className="w-32 rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => setShowGeofence(true)}
              className="self-start text-xs text-text-muted underline-offset-2 hover:text-accent-muted hover:underline"
            >
              Customize geofence radius (default {DEFAULT_GEOFENCE_M}m)
            </button>
          )}

          {isEditing && (
            <p className="rounded-md bg-warning-bg px-3 py-2 text-xs leading-relaxed text-warning">
              Moving this stop won't recalculate distance on routes that already use it — only
              routes you create or edit after saving will reflect the new location.
            </p>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
            >
              {isSaving ? "Saving…" : isEditing ? "Save changes" : "Save stop"}
            </button>
          </div>
      </form>
    </Modal>
  );
}
