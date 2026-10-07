import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import { isAxiosError } from "axios";
import { useCreateRoute, useSchool, useUpdateRoute } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { RoadLeg } from "../lib/googleRoutes";
import type { ApiError, Route, Stop, Vehicle } from "../lib/types";
import { Modal } from "./Modal";
import { RouteStopsPreviewMap } from "./RouteStopsPreviewMap";

type Step = "edit" | "confirm";

function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function RouteModal({
  tenantId,
  route,
  stopsPool,
  vehicles,
  onClose,
}: {
  tenantId: string;
  /** Omit to create a new route; pass an existing one to edit it. */
  route?: Route;
  stopsPool: Stop[];
  vehicles: Vehicle[];
  onClose: () => void;
}) {
  const isEditing = route != null;
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const school = useSchool(tenantId);
  const { showSuccess, showError } = useToast();

  const initialStops = isEditing
    ? route.stops
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((rs) => stopsPool.find((s) => s.id === rs.stopId))
        .filter((s): s is Stop => s != null)
    : [];

  const [step, setStep] = useState<Step>("edit");
  const [name, setName] = useState(route?.name ?? "");
  const [vehicleId, setVehicleId] = useState(route?.vehicleId ?? "");
  const [orderedStops, setOrderedStops] = useState<Stop[]>(initialStops);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Lives here, not inside RouteStopsPreviewMap, so it survives that component unmounting when
  // going back to edit and returning to confirm — already-previewed legs aren't re-fetched.
  // Seeded from the route's own already-saved data when editing: if a leg's stop order hasn't
  // changed, its real road path is already sitting in the database from the last save, so the
  // confirm screen shouldn't pay for (or wait on) a fresh Google Routes API call to re-learn
  // something it already knows. Only legs with a real stored polyline count as "cached" — a
  // route saved before the polyline column existed (has distance but no polyline) is treated as
  // not-yet-known, so it gets a real fetch and picks up a polyline next save, rather than being
  // permanently stuck showing a straight line.
  const [legCache, setLegCache] = useState<Map<string, RoadLeg | null>>(() => {
    if (!isEditing) return new Map();
    const sorted = route.stops.slice().sort((a, b) => a.position - b.position);
    const prefill = new Map<string, RoadLeg | null>();
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current.roadDistanceToNextM != null && current.roadDurationToNextS != null && current.roadPolylineToNext) {
        prefill.set(`${current.stopId}:${next.stopId}`, {
          distanceMeters: current.roadDistanceToNextM,
          durationSeconds: current.roadDurationToNextS,
          polyline: current.roadPolylineToNext,
        });
      }
    }
    return prefill;
  });

  const availableStops = stopsPool.filter((s) => !orderedStops.some((o) => o.id === s.id));
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  function handleSelectStop(e: React.ChangeEvent<HTMLSelectElement>) {
    const stop = stopsPool.find((s) => s.id === e.target.value);
    if (!stop) return;
    setOrderedStops((prev) => [...prev, stop]);
    e.target.value = "";
  }

  function removeStop(stopId: string) {
    setOrderedStops((prev) => prev.filter((s) => s.id !== stopId));
  }

  // Keyboard/touch-friendly alternative to the drag handle below — native HTML5 drag-and-drop
  // doesn't fire on touch devices and isn't reachable by keyboard at all.
  function moveStop(index: number, direction: -1 | 1) {
    setOrderedStops((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    if (draggedIndex !== null && index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(index: number) {
    setOrderedStops((prev) => {
      if (draggedIndex === null || draggedIndex === index) return prev;
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  // The final "last stop -> school" leg's cache key needs the school's id, which loads
  // asynchronously — prefilled separately from the stop-to-stop legs above, once available,
  // merging in rather than overwriting what's already cached.
  useEffect(() => {
    if (!isEditing || !school.data) return;
    const sorted = route.stops.slice().sort((a, b) => a.position - b.position);
    const last = sorted[sorted.length - 1];
    if (!last || last.roadDistanceToNextM == null || last.roadDurationToNextS == null || !last.roadPolylineToNext) {
      return;
    }
    const key = `${last.stopId}:${school.data.id}`;
    setLegCache((prev) => {
      if (prev.has(key)) return prev;
      const next = new Map(prev);
      next.set(key, {
        distanceMeters: last.roadDistanceToNextM!,
        durationSeconds: last.roadDurationToNextS!,
        polyline: last.roadPolylineToNext,
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, school.data]);

  function handleLegsResolved(results: (readonly [string, RoadLeg | null])[]) {
    setLegCache((prev) => {
      const next = new Map(prev);
      results.forEach(([key, leg]) => next.set(key, leg));
      return next;
    });
  }

  function handleContinueToPreview(e: React.FormEvent) {
    e.preventDefault();
    if (orderedStops.length === 0) {
      showError("Add at least one stop.");
      return;
    }
    setStep("confirm");
  }

  async function handleConfirmSave() {
    const stopIdsInOrder = orderedStops.map((s) => s.id);
    try {
      if (isEditing) {
        await updateRoute.mutateAsync({
          routeId: route.id,
          request: { name, vehicleId, stopIdsInOrder },
        });
        showSuccess("Route updated");
      } else {
        await createRoute.mutateAsync({ tenantId, name, vehicleId, stopIdsInOrder });
        showSuccess("Route created");
      }
      onClose();
    } catch (err) {
      // Surfaces the backend's own message — e.g. ROUTE_IN_USE's "already has ride history"
      // explanation, or NO_SCHOOL_FOR_TENANT — rather than a generic failure.
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  const isSaving = createRoute.isPending || updateRoute.isPending;

  return (
    <Modal maxWidthClassName={step === "confirm" ? "max-w-3xl" : "max-w-2xl"}>
      <h2 className="text-lg font-semibold text-text-primary">
        {step === "confirm" ? "Confirm route" : isEditing ? "Edit route" : "Add a route"}
      </h2>

      {step === "edit" && (
        <>
          <p className="mt-1 text-sm text-text-muted">Stops are visited in the order shown below.</p>
          <form onSubmit={handleContinueToPreview} className="mt-4 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
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
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.regNo} · {v.vehicleTypeName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <h3 className="text-base font-semibold text-text-primary">Stops, in order</h3>
              <p className="mt-1 text-xs text-text-muted">
                Drag a card by its handle to reorder, or use the ▲▼ buttons.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {orderedStops.map((stop, index) => (
                  <div
                    key={stop.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={
                      "flex items-center gap-3 rounded-md border-t-2 bg-bg-base px-3 py-2.5 transition-all duration-150 " +
                      (draggedIndex === index ? "opacity-40" : "") +
                      (dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
                        ? " border-accent"
                        : " border-transparent")
                    }
                  >
                    <span
                      className="cursor-grab text-text-muted active:cursor-grabbing"
                      title="Drag to reorder"
                    >
                      <GripIcon className="h-4 w-4" />
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-bg text-xs font-semibold text-accent-muted">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-sm text-text-primary">{stop.name}</span>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveStop(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${stop.name} up`}
                        className="leading-none text-text-muted hover:text-text-primary disabled:opacity-25 disabled:hover:text-text-muted"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStop(index, 1)}
                        disabled={index === orderedStops.length - 1}
                        aria-label={`Move ${stop.name} down`}
                        className="leading-none text-text-muted hover:text-text-primary disabled:opacity-25 disabled:hover:text-text-muted"
                      >
                        ▼
                      </button>
                    </div>
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

                <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5">
                  <span className="text-accent-muted">+</span>
                  <select
                    value=""
                    onChange={handleSelectStop}
                    disabled={availableStops.length === 0}
                    className="flex-1 bg-transparent text-sm text-text-primary outline-none disabled:text-text-muted"
                  >
                    <option value="" disabled>
                      {availableStops.length === 0 ? "No more stops available" : "Add a stop…"}
                    </option>
                    {availableStops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-3 text-xs text-text-muted">
                Real road distance/duration between consecutive stops is fetched once,
                automatically, when you save (one Google Routes API call per leg — see
                CLAUDE.md). Per-stop pickup times shown in the design aren't computed yet — that
                needs a scheduling feature we haven't built.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
              >
                {isEditing ? "Save changes" : "Save route"}
              </button>
            </div>
          </form>
        </>
      )}

      {step === "confirm" && (
        <>
          <p className="mt-1 text-sm text-text-muted">
            Review the real road path before this is saved.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <RouteStopsPreviewMap
              orderedStops={orderedStops}
              school={school.data ?? null}
              legCache={legCache}
              onLegsResolved={handleLegsResolved}
            />
            <div className="rounded-md bg-bg-base px-4 py-3 text-sm">
              <p className="font-medium text-text-primary">{name}</p>
              <p className="text-text-muted">{vehicle ? `${vehicle.regNo} · ${vehicle.vehicleTypeName}` : "No vehicle assigned"}</p>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setStep("edit")}
                className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
              >
                Back to edit
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
              >
                {isSaving ? "Saving…" : isEditing ? "Confirm & save changes" : "Confirm & save route"}
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
