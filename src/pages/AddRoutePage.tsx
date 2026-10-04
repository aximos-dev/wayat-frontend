import { useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useCreateRoute, useStops, useVehicles } from "../lib/queries";
import type { ApiError, Stop } from "../lib/types";

export function AddRoutePage() {
  const { principal } = useAuth();
  const tenantId = principal!.tenantId;
  const navigate = useNavigate();

  const stopsQuery = useStops(tenantId);
  const vehiclesQuery = useVehicles(tenantId);
  const createRoute = useCreateRoute();

  const [name, setName] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [orderedStops, setOrderedStops] = useState<Stop[]>([]);
  const [stopToAdd, setStopToAdd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const availableStops = (stopsQuery.data ?? []).filter(
    (s) => !orderedStops.some((o) => o.id === s.id),
  );

  function addStop() {
    const stop = stopsQuery.data?.find((s) => s.id === stopToAdd);
    if (!stop) return;
    setOrderedStops((prev) => [...prev, stop]);
    setStopToAdd("");
  }

  function removeStop(stopId: string) {
    setOrderedStops((prev) => prev.filter((s) => s.id !== stopId));
  }

  function moveStop(index: number, direction: -1 | 1) {
    setOrderedStops((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (orderedStops.length === 0) {
      setError("Add at least one stop.");
      return;
    }
    try {
      await createRoute.mutateAsync({
        tenantId,
        name,
        vehicleId,
        stopIdsInOrder: orderedStops.map((s) => s.id),
      });
      navigate("/routes-stops");
    } catch (err) {
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary">Add a route</h1>
      <p className="mt-1 text-sm text-text-muted">Stops are visited in the order shown below</p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-2xl rounded-xl border border-border bg-bg-surface p-6"
      >
        <h2 className="text-base font-semibold text-text-primary">Route details</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Route name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Route 8"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Assign vehicle</span>
            <select
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            >
              <option value="" disabled>
                — Choose an available vehicle —
              </option>
              {vehiclesQuery.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.regNo} · {v.type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h2 className="mt-6 text-base font-semibold text-text-primary">Stops, in order</h2>
        <div className="mt-3 flex flex-col gap-2">
          {orderedStops.map((stop, index) => (
            <div
              key={stop.id}
              className="flex items-center gap-3 rounded-md bg-bg-base px-3 py-2.5"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-bg text-xs font-semibold text-accent-muted">
                {index + 1}
              </span>
              <span className="flex-1 text-sm text-text-primary">{stop.name}</span>
              <button
                type="button"
                onClick={() => moveStop(index, -1)}
                disabled={index === 0}
                className="text-text-muted hover:text-text-primary disabled:opacity-30"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveStop(index, 1)}
                disabled={index === orderedStops.length - 1}
                className="text-text-muted hover:text-text-primary disabled:opacity-30"
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeStop(stop.id)}
                className="text-text-muted hover:text-danger"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex gap-2 rounded-md border border-dashed border-border px-3 py-2.5">
            <select
              value={stopToAdd}
              onChange={(e) => setStopToAdd(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary outline-none"
            >
              <option value="" disabled>
                {availableStops.length === 0 ? "No more stops available" : "— Choose a stop —"}
              </option>
              {availableStops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addStop}
              disabled={!stopToAdd}
              className="text-sm font-medium text-accent-muted disabled:opacity-40"
            >
              + Add a stop
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Real road distance/duration between consecutive stops is fetched once, automatically,
          when you save (one Google Routes API call per leg — see CLAUDE.md). Per-stop pickup
          times shown in the design aren't computed yet — that needs a scheduling feature we
          haven't built.
        </p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/routes-stops")}
            className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createRoute.isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
          >
            {createRoute.isPending ? "Saving…" : "Save route"}
          </button>
        </div>
      </form>
    </div>
  );
}
