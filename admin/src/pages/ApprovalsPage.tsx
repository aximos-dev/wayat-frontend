import { useState } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "../lib/AuthContext";
import { usePagedSearch } from "../lib/usePagedSearch";
import { useAutoResolvePending, useRoutes, useSchool, useStopRequests, useStops } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import { PaginationBar, SearchBar } from "../components/SearchAndPagination";
import { ConfirmStopModal } from "../components/ConfirmStopModal";
import { StopRequestModal } from "../components/StopRequestModal";
import { InfoIcon, Tooltip } from "../components/Tooltip";
import { formatMinutes, RESOLUTION_LABEL, resolutionSummary, REVIEW_REASON_LABEL } from "../lib/stopRequestLabels";
import type { ApiError, StopRequest } from "../lib/types";

// AUTO and APPROVED are both status APPROVED on the backend, split by `autoApproved` — the admin
// only needs to skim what the system did, but should see their own decisions separately.
// NEW_STOPS isn't a request status at all — it's stops the system created on a bus's road that
// an admin hasn't checked yet, listed here because this is where the admin already looks.
type Tab = "PENDING" | "NEW_STOPS" | "COUNTER_PROPOSED" | "AUTO" | "APPROVED" | "REJECTED";

function requestMatches(request: StopRequest, query: string): boolean {
  const target = request.type === "EXISTING_STOP" ? request.existingStopName : request.proposedName;
  return (
    request.childName.toLowerCase().includes(query) ||
    request.parentName.toLowerCase().includes(query) ||
    (target?.toLowerCase().includes(query) ?? false)
  );
}

function TypeBadge({ request }: { request: StopRequest }) {
  return (
    <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs text-accent-muted">
      {request.type === "EXISTING_STOP" ? "Existing stop" : "New stop"}
    </span>
  );
}

/** One line on why a request is where it is — the reason a pending one needs a person, or what
 *  the system did with an auto-approved one. */
function OutcomeBadge({ request }: { request: StopRequest }) {
  if (request.status === "PENDING" && request.reviewReason) {
    const tone = request.reviewReason === "NEW_LOCATION" ? "bg-neutral-bg text-neutral" : "bg-warning-bg text-warning";
    return (
      <span className="flex flex-col items-start gap-0.5">
        <span className={"rounded-full px-2 py-0.5 text-xs " + tone}>{REVIEW_REASON_LABEL[request.reviewReason]}</span>
        {request.reviewReason === "DETOUR_TOO_LONG" && request.detourS != null && (
          <span className="text-xs text-text-muted">cheapest detour +{formatMinutes(request.detourS)}</span>
        )}
      </span>
    );
  }
  if (request.status === "APPROVED" && request.autoApproved) {
    const summary = resolutionSummary(request);
    return (
      <span className="flex flex-col items-start gap-0.5">
        <span className="flex flex-wrap gap-1">
          <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs text-success">
            {request.resolution ? RESOLUTION_LABEL[request.resolution] : "Auto"}
          </span>
          {request.viaGraceSeat && (
            <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">Grace seat</span>
          )}
        </span>
        {summary && <span className="text-xs text-text-muted">{summary}</span>}
      </span>
    );
  }
  return <span className="text-text-muted">—</span>;
}

export function ApprovalsPage() {
  const { principal } = useAuth();
  const tenantId = principal!.tenantId;
  const [tab, setTab] = useState<Tab>("PENDING");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [checkingStopId, setCheckingStopId] = useState<string | null>(null);
  const stops = useStops(tenantId);
  const routes = useRoutes(tenantId);
  const school = useSchool(tenantId);
  const autoResolve = useAutoResolvePending(tenantId);
  const { showSuccess, showError } = useToast();

  const pending = useStopRequests(tenantId, "PENDING");
  const counterProposed = useStopRequests(tenantId, "COUNTER_PROPOSED");
  const approved = useStopRequests(tenantId, "APPROVED");
  const rejected = useStopRequests(tenantId, "REJECTED");

  const autoApproved = approved.data?.filter((r) => r.autoApproved);
  const manuallyApproved = approved.data?.filter((r) => !r.autoApproved);

  const stopsToCheck = (stops.data ?? []).filter((s) => s.autoCreated && !s.confirmedAt);
  const routeContaining = (stopId: string) => routes.data?.find((r) => r.stops.some((rs) => rs.stopId === stopId)) ?? null;
  const requestThatCreated = (stopId: string) =>
    approved.data?.find((r) => r.autoCreatedStop && r.resultStopId === stopId) ?? null;
  const checkingStop = stopsToCheck.find((s) => s.id === checkingStopId) ?? null;

  const current = {
    PENDING: pending,
    NEW_STOPS: pending, // unused — NEW_STOPS renders its own table below
    COUNTER_PROPOSED: counterProposed,
    AUTO: { ...approved, data: autoApproved },
    APPROVED: { ...approved, data: manuallyApproved },
    REJECTED: rejected,
  }[tab];

  const search = usePagedSearch(current.data, requestMatches);
  const allLoaded = [...(pending.data ?? []), ...(counterProposed.data ?? []), ...(approved.data ?? []), ...(rejected.data ?? [])];
  const reviewing = allLoaded.find((r) => r.id === reviewingId) ?? null;
  const count = current.data?.length ?? 0;
  const pendingCount = pending.data?.length ?? 0;
  const counterProposedCount = counterProposed.data?.length ?? 0;

  async function handleAutoResolve() {
    try {
      const summary = await autoResolve.mutateAsync();
      showSuccess(
        summary.approved > 0
          ? `${summary.approved} approved automatically · ${summary.stillPending} still need you`
          : `Nothing new to approve · ${summary.stillPending} still need you`,
      );
    } catch (err) {
      showError(isAxiosError<ApiError>(err) && err.response?.data?.message ? err.response.data.message : "Something went wrong.");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Approvals</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
            Requests approve themselves whenever there's a walkable stop or a short detour — only the rest land
            here.
            <Tooltip
              trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
              content="For a home pin, cheapest option within limits: 1) a stop the child can walk to — existing, or new on a road a bus already drives — checked with real walking directions against a per-grade limit (300 m Grades 1–4, 500 m Grades 5–8, 800 m Grade 9+); 2) otherwise a short detour by the home, if it adds 4 min or less and keeps the ride under 75 min; 3) otherwise a shared detour stop once nearby families ask too. New stops are listed under New stops to check. Normal seats first, grace (standing) seats if that's all that's left."
            />
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleAutoResolve()}
          disabled={autoResolve.isPending || pendingCount === 0}
          title="Re-run auto-approval on everything pending — e.g. after a seat frees up or a route changes"
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-primary transition-colors hover:border-accent disabled:opacity-50"
        >
          {autoResolve.isPending ? "Checking…" : "Re-check pending"}
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {([
            ["PENDING", `Needs review${pendingCount > 0 ? ` (${pendingCount})` : ""}`],
            ["NEW_STOPS", `New stops to check${stopsToCheck.length > 0 ? ` (${stopsToCheck.length})` : ""}`],
            ["COUNTER_PROPOSED", `Awaiting parent${counterProposedCount > 0 ? ` (${counterProposedCount})` : ""}`],
            ["AUTO", "Auto-approved"],
            ["APPROVED", "Approved"],
            ["REJECTED", "Rejected"],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "rounded-md px-3 py-1.5 text-sm " +
                (tab === t ? "bg-accent-bg text-accent-muted" : "text-text-muted hover:text-text-primary")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <SearchBar value={search.query} onChange={search.setQuery} placeholder="Search by student, parent, or stop…" />
      </div>

      {tab === "NEW_STOPS" ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
                <th className="px-5 py-3 font-medium">Stop</th>
                <th className="px-5 py-3 font-medium">Route</th>
                <th className="px-5 py-3 font-medium">Added for</th>
                <th className="px-5 py-3 font-medium">Added</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {stopsToCheck.length === 0 && (
                <tr>
                  <td className="px-5 py-4 text-text-muted" colSpan={5}>
                    No new stops to check. When a home is near a road a bus already drives, the system adds a stop
                    there by itself — those show up here for a quick look.
                  </td>
                </tr>
              )}
              {stopsToCheck.map((stop) => {
                const route = routeContaining(stop.id);
                const request = requestThatCreated(stop.id);
                const position = route?.stops.find((rs) => rs.stopId === stop.id)?.position;
                return (
                  <tr key={stop.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                    <td className="px-5 py-3 font-medium text-text-primary">{stop.name}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {route ? `${route.name}${position != null ? ` · stop #${position + 1}` : ""}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-text-muted">
                      {request ? (
                        <>
                          <p className="text-text-primary">{request.childName}</p>
                          {request.snappedDistanceM != null && (
                            <p className="text-xs">{Math.round(request.snappedDistanceM)} m from home pin</p>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3 text-text-muted">{new Date(stop.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setCheckingStopId(stop.id)}
                        className="text-xs font-medium text-accent-muted hover:text-accent"
                      >
                        Check
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
              <th className="px-5 py-3 font-medium">Student</th>
              <th className="px-5 py-3 font-medium">Parent</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Requested</th>
              <th className="px-5 py-3 font-medium">{tab === "PENDING" ? "Why" : "Outcome"}</th>
              <th className="px-5 py-3 font-medium">Submitted</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {current.isLoading && (
              <tr><td className="px-5 py-4 text-text-muted" colSpan={7}>Loading…</td></tr>
            )}
            {!current.isLoading && count === 0 && (
              <tr>
                <td className="px-5 py-4 text-text-muted" colSpan={7}>
                  {tab === "PENDING"
                    ? "Nothing needs you — everything that could be approved automatically has been."
                    : tab === "COUNTER_PROPOSED"
                      ? "No requests waiting on a parent's response right now."
                      : tab === "AUTO"
                        ? "Nothing approved automatically yet."
                        : `No ${tab.toLowerCase()} requests yet.`}
                </td>
              </tr>
            )}
            {!current.isLoading && count > 0 && search.totalCount === 0 && (
              <tr><td className="px-5 py-4 text-text-muted" colSpan={7}>No requests match "{search.query}".</td></tr>
            )}
            {search.paged.map((request) => (
              <tr key={request.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                <td className="px-5 py-3">
                  <p className="font-medium text-text-primary">{request.childName}</p>
                  <p className="text-xs text-text-muted">
                    {request.className} / {request.sectionName}
                  </p>
                </td>
                <td className="px-5 py-3 text-text-muted">
                  <p className="text-text-primary">{request.parentName}</p>
                  <p className="text-xs">{request.parentPhone}</p>
                </td>
                <td className="px-5 py-3">
                  <TypeBadge request={request} />
                </td>
                <td className="px-5 py-3 text-text-muted">
                  {request.type === "EXISTING_STOP" ? request.existingStopName : request.proposedName}
                  {request.resultStopName && request.resultStopName !== request.proposedName && request.type === "NEW_STOP" && (
                    <p className="text-xs">→ {request.resultStopName}</p>
                  )}
                </td>
                <td className="px-5 py-3">
                  <OutcomeBadge request={request} />
                </td>
                <td className="px-5 py-3 text-text-muted">{new Date(request.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setReviewingId(request.id)}
                    className="text-xs font-medium text-accent-muted hover:text-accent"
                  >
                    {request.status === "PENDING" ? "Review" : "View"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar
          page={search.page}
          totalPages={search.totalPages}
          totalCount={search.totalCount}
          pageSize={search.pageSize}
          onPageChange={search.setPage}
        />
      </div>
      )}

      {checkingStop && (
        <ConfirmStopModal
          tenantId={tenantId}
          stop={checkingStop}
          route={routeContaining(checkingStop.id)}
          allStops={stops.data ?? []}
          school={school.data ?? null}
          request={requestThatCreated(checkingStop.id)}
          onClose={() => setCheckingStopId(null)}
        />
      )}

      {reviewing && (
        <StopRequestModal tenantId={tenantId} stopRequest={reviewing} onClose={() => setReviewingId(null)} />
      )}
    </div>
  );
}
