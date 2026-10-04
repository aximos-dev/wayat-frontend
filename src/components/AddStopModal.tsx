import { useState } from "react";
import { isAxiosError } from "axios";
import { useCreateStop } from "../lib/queries";
import type { ApiError } from "../lib/types";

export function AddStopModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const createStop = useCreateStop();
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createStop.mutateAsync({
        tenantId,
        name,
        lat: Number(lat),
        lng: Number(lng),
      });
      onClose();
    } catch (err) {
      // Surfaces the backend's own message — e.g. DUPLICATE_STOP's "within 30m of an existing
      // stop" explanation (see StopService) — rather than a generic failure.
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary">Add a stop</h2>
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
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-text-muted">Latitude</span>
              <input
                required
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="12.9352"
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-text-muted">Longitude</span>
              <input
                required
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="77.5623"
                className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
              />
            </label>
          </div>
          <p className="text-xs text-text-muted">
            No map picker yet — type coordinates directly (e.g. from Google Maps' "copy
            coordinates"). A real map-pin picker is a known gap, not built yet.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
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
              disabled={createStop.isPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
            >
              {createStop.isPending ? "Saving…" : "Save stop"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
