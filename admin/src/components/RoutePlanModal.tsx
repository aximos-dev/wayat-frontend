import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useApplyRoutePlan, useRoutePlanPreview } from "../lib/queries";
import { formatMinutes } from "../lib/stopRequestLabels";
import { useToast } from "../lib/ToastContext";
import type { ApiError, RoutePlan } from "../lib/types";
import { Modal } from "./Modal";

/** Routes linked by a stop moving between them must be applied together — applying only one side
 *  would take the stop off every route (the backend refuses that). This groups changed routes into
 *  those linked sets. */
function groupLinkedRoutes(plans: RoutePlan[]): RoutePlan[][] {
  const changed = plans.filter((p) => p.changed && !p.locked);
  const byName = new Map(changed.map((p) => [p.routeName, p]));
  const parent = new Map(changed.map((p) => [p.routeId, p.routeId]));
  const find = (id: string): string => (parent.get(id) === id ? id : find(parent.get(id)!));
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  changed.forEach((p) =>
    p.movedOut.forEach(({ second }) => {
      const target = byName.get(second);
      if (target) union(p.routeId, target.routeId);
    }),
  );
  const groups = new Map<string, RoutePlan[]>();
  changed.forEach((p) => groups.set(find(p.routeId), [...(groups.get(find(p.routeId)) ?? []), p]));
  return [...groups.values()];
}

function minutes(seconds: number | null): string {
  return seconds == null ? "—" : `${Math.round(seconds / 60)} min`;
}

function RouteChangeCard({ plan }: { plan: RoutePlan }) {
  const saved = plan.currentDriveS != null && plan.proposedDriveS != null ? plan.currentDriveS - plan.proposedDriveS : null;
  return (
    <div className="rounded-md bg-bg-base px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-text-primary">{plan.routeName}</p>
        <p className="text-xs text-text-muted">
          Ride {minutes(plan.currentRideS)} → <span className="text-text-primary">{minutes(plan.proposedRideS)}</span>
          {saved != null && saved !== 0 && (
            <span className={"ml-2 " + (saved > 0 ? "text-success" : "text-warning")}>
              {saved > 0 ? `−${formatMinutes(saved)}` : `+${formatMinutes(-saved)}`} driving
            </span>
          )}
        </p>
      </div>
      <ol className="mt-2 flex flex-col gap-1">
        {plan.proposedStops.map((stop, i) => (
          <li key={stop.stopId} className="flex items-center gap-2 text-sm">
            <span
              className={
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                (stop.movedFromRouteName ? "text-bg-base" : "bg-accent-bg text-accent-muted")
              }
              style={stop.movedFromRouteName ? { backgroundColor: "#4EA1F7" } : undefined}
            >
              {i + 1}
            </span>
            <span className="text-text-primary">{stop.name}</span>
            {stop.movedFromRouteName && <span className="text-xs text-text-muted">from {stop.movedFromRouteName}</span>}
          </li>
        ))}
      </ol>
      {plan.movedOut.length > 0 && (
        <p className="mt-2 text-xs text-text-muted">
          Moves to other routes: {plan.movedOut.map(({ first, second }) => `${first} → ${second}`).join(", ")}
        </p>
      )}
    </div>
  );
}

/**
 * Admin's "re-plan routes" review. Asks the backend for a proposed plan (nothing is saved), shows
 * each change set with before/after times and the new stop order, and applies only the ones the
 * admin ticks. Meant to be run occasionally — e.g. before a new term — since stops added one at a
 * time slowly leave routes in a less efficient order.
 */
export function RoutePlanModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const preview = useRoutePlanPreview(tenantId);
  const apply = useApplyRoutePlan(tenantId);
  const { showSuccess, showError } = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    preview.mutate(undefined, {
      onSuccess: (plan) => setSelected(new Set(groupLinkedRoutes(plan.routes).map((_, i) => i))),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = preview.data;
  const groups = useMemo(() => (plan ? groupLinkedRoutes(plan.routes) : []), [plan]);
  const unchanged = plan?.routes.filter((r) => !r.changed && !r.locked) ?? [];
  const locked = plan?.routes.filter((r) => r.locked) ?? [];
  const selectedSaving = groups
    .filter((_, i) => selected.has(i))
    .flat()
    .reduce((sum, r) => sum + ((r.currentDriveS ?? 0) - (r.proposedDriveS ?? 0)), 0);

  async function handleApply() {
    const changes = groups
      .filter((_, i) => selected.has(i))
      .flat()
      .map((r) => ({ routeId: r.routeId, stopIdsInOrder: r.proposedStops.map((s) => s.stopId) }));
    try {
      await apply.mutateAsync({ tenantId, changes });
      showSuccess(`${changes.length} route${changes.length === 1 ? "" : "s"} updated`);
      onClose();
    } catch (err) {
      showError(isAxiosError<ApiError>(err) && err.response?.data?.message ? err.response.data.message : "Something went wrong.");
    }
  }

  return (
    <Modal maxWidthClassName="max-w-3xl">
      <h2 className="text-lg font-semibold text-text-primary">Re-plan routes</h2>
      <p className="mt-1 text-sm text-text-muted">
        Finds a faster stop order for each route, and moves a few stops to a route that passes them more cheaply —
        only onto buses with free normal seats. Nothing changes until you apply it. Worth running before a new term,
        since stops added one at a time slowly make routes less efficient.
      </p>

      {preview.isPending && (
        <div className="mt-6 flex items-center gap-2 text-sm text-text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          Working out real driving times…
        </div>
      )}
      {preview.isError && <p className="mt-4 text-sm text-danger">Couldn't build a plan — try again.</p>}

      {plan && (
        <div className="mt-4 flex flex-col gap-4">
          {plan.notes.length > 0 && (
            <div className="rounded-md border border-warning/40 bg-warning-bg/30 px-3 py-2 text-sm text-warning">
              {plan.notes.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          )}

          {groups.length === 0 ? (
            <p className="rounded-md bg-bg-base px-3 py-2.5 text-sm text-text-muted">
              Every route is already in its best order — nothing to change.
            </p>
          ) : (
            <>
              <p className="text-sm text-text-primary">
                Saves about <span className="font-medium text-success">{formatMinutes(plan.totalSavedS)}</span> of
                driving per run across {groups.flat().length} route{groups.flat().length === 1 ? "" : "s"}.
              </p>
              {groups.map((group, i) => (
                <label key={group.map((r) => r.routeId).join()} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        return next;
                      })
                    }
                    className="mt-3 h-4 w-4 accent-accent"
                  />
                  <div className="flex flex-1 flex-col gap-2">
                    {group.length > 1 && (
                      <p className="text-xs text-text-muted">
                        These {group.length} routes swap stops, so they're applied together.
                      </p>
                    )}
                    {group.map((r) => (
                      <RouteChangeCard key={r.routeId} plan={r} />
                    ))}
                  </div>
                </label>
              ))}
            </>
          )}

          {(unchanged.length > 0 || locked.length > 0) && (
            <p className="text-xs text-text-muted">
              {unchanged.length > 0 && <>Already in the best order: {unchanged.map((r) => r.routeName).join(", ")}. </>}
              {locked.length > 0 && <>Not changed (has ride history): {locked.map((r) => r.routeName).join(", ")}.</>}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">
        <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-text-primary">
          Close
        </button>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={apply.isPending || selected.size === 0}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
          >
            {apply.isPending
              ? "Applying…"
              : `Apply selected${selectedSaving > 0 ? ` (−${formatMinutes(selectedSaving)})` : ""}`}
          </button>
        )}
      </div>
    </Modal>
  );
}
