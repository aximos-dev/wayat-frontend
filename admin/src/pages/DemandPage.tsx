import { useMemo, useState } from "react";
import clsx from "clsx";
import { APIProvider, ColorScheme, Map, Marker } from "@vis.gl/react-google-maps";
import { useAuth } from "../lib/AuthContext";
import { useDemandBoard, useDemandSchool, useTenant } from "../lib/queries";
import { FitBounds, MAP_LIBRARIES, SCHOOL_MARKER_ICON } from "../components/routeMapShared";
import { InfoIcon, Tooltip } from "../components/Tooltip";
import { LaunchSchoolModal } from "../components/LaunchSchoolModal";
import type { DemandFamily, DemandSchool, LaunchedSchool } from "../lib/types";

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };

const HOME_ICON: google.maps.Icon = {
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="6" fill="#FFC531" stroke="#15171C" stroke-width="2"/>' +
        "</svg>",
    ),
  scaledSize: { width: 18, height: 18 } as google.maps.Size,
  anchor: { x: 9, y: 9 } as google.maps.Point,
};

// Stale families (no "still interested" for a while) are drawn dimmer — they may not convert.
const STALE_HOME_ICON: google.maps.Icon = {
  ...HOME_ICON,
  url:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="6" fill="#666E7C" stroke="#15171C" stroke-width="2"/>' +
        "</svg>",
    ),
};

function rupees(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-medium text-text-primary" title={hint}>
        {value}
      </p>
    </div>
  );
}

/** One school our fleet doesn't run to yet, and the demand waiting for it. */
function SchoolCard({
  school,
  selected,
  launchMin,
  onSelect,
}: {
  school: DemandSchool;
  selected: boolean;
  launchMin: number;
  onSelect: () => void;
}) {
  const fresh = school.children;
  const progress = Math.min(1, fresh / launchMin);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "w-full rounded-xl border bg-bg-surface p-4 text-left transition-colors",
        selected ? "border-accent" : "border-border hover:border-text-muted",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">{school.name}</p>
          {school.address && <p className="truncate text-xs text-text-muted">{school.address}</p>}
        </div>
        {school.readyToLaunch ? (
          <span className="shrink-0 rounded-full bg-success-bg px-2 py-0.5 text-xs text-success">Ready to launch</span>
        ) : (
          <span className="shrink-0 rounded-full bg-neutral-bg px-2 py-0.5 text-xs text-neutral">Collecting</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-3">
        <Stat
          label="Children"
          value={`${school.children}`}
          hint={`${school.families} families${school.staleFamilies > 0 ? ` (+${school.staleChildren} stale)` : ""}`}
        />
        <Stat label="Per month" value={rupees(school.monthlyRevenueInr)} />
        <Stat label="Vans" value={`${school.vansNeeded}`} />
        <Stat
          label="Clustered"
          value={`${Math.round(school.clusterShare * 100)}%`}
          hint="Share of families living close together — high means one route could collect most of them"
        />
      </div>

      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className={clsx("h-full rounded-full", school.readyToLaunch ? "bg-success" : "bg-accent")}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-text-muted">
          {fresh} of {launchMin} children to launch
          {school.medianDistanceKm != null && ` · homes ~${school.medianDistanceKm} km away`}
          {school.staleFamilies > 0 && ` · +${school.staleFamilies} stale famil${school.staleFamilies === 1 ? "y" : "ies"} not counted`}
          {` · oldest ${school.oldestRequestDays}d`}
        </p>
      </div>
    </button>
  );
}

function FamilyRow({ family }: { family: DemandFamily }) {
  return (
    <div className={clsx("flex items-start justify-between gap-3 border-b border-border py-3 last:border-0", family.stale && "opacity-60")}>
      <div className="min-w-0">
        <p className="text-sm text-text-primary">
          {family.parentName} <span className="text-text-muted">· {family.phone}</span>
        </p>
        <p className="text-xs text-text-muted">
          {family.children.map((c) => `${c.name} (${c.className}${c.sectionName ? "-" + c.sectionName : ""})`).join(", ")}
        </p>
        {family.homeAddress && <p className="truncate text-xs text-text-muted">{family.homeAddress}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs text-text-primary">
          {family.plan === "PREMIUM" ? "Premium" : family.plan === "BASIC" ? "Basic" : "—"}
          {family.monthlyTotalInr != null && ` · ${rupees(family.monthlyTotalInr)}`}
        </p>
        <p className="text-xs text-text-muted">
          joined {daysAgo(family.requestedAt)}
          {family.stale && " · stale"}
        </p>
      </div>
    </div>
  );
}

function SchoolDetail({ schoolRef }: { schoolRef: string }) {
  const detail = useDemandSchool(schoolRef);
  const [launching, setLaunching] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const school = detail.data?.school;
  const families = useMemo(() => detail.data?.families ?? [], [detail.data]);
  const points = useMemo(() => {
    const p: google.maps.LatLngLiteral[] = families.map((f) => ({ lat: f.homeLat, lng: f.homeLng }));
    if (school?.lat != null && school.lng != null) p.push({ lat: school.lat, lng: school.lng });
    return p;
  }, [families, school]);

  if (detail.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!school) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{school.name}</h2>
          <p className="text-sm text-text-muted">
            {school.families} families · {school.children} children ({school.premiumChildren} Premium, {school.basicChildren} Basic) ·{" "}
            {rupees(school.monthlyRevenueInr)}/month · {school.vansNeeded} van{school.vansNeeded === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLaunching(true)}
          className={clsx(
            "shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            school.readyToLaunch ? "bg-accent text-bg-base" : "border border-border text-text-primary hover:border-accent",
          )}
        >
          Plan launch
        </button>
      </div>
      {launching && <LaunchSchoolModal schoolRef={schoolRef} onClose={() => setLaunching(false)} />}

      {apiKey ? (
        <APIProvider apiKey={apiKey} libraries={MAP_LIBRARIES}>
          <div className="h-80 w-full overflow-hidden rounded-xl border border-border">
            <Map
              defaultCenter={points[0] ?? DEFAULT_CENTER}
              defaultZoom={12}
              disableDefaultUI
              clickableIcons={false}
              colorScheme={ColorScheme.DARK}
            >
              <FitBounds points={points} />
              {school.lat != null && school.lng != null && (
                <Marker position={{ lat: school.lat, lng: school.lng }} icon={SCHOOL_MARKER_ICON} title={school.name} />
              )}
              {families.map((f) => (
                <Marker
                  key={f.enrolmentId}
                  position={{ lat: f.homeLat, lng: f.homeLng }}
                  icon={f.stale ? STALE_HOME_ICON : HOME_ICON}
                  title={`${f.parentName} — ${f.children.map((c) => c.name).join(", ")}`}
                />
              ))}
            </Map>
          </div>
        </APIProvider>
      ) : (
        <p className="text-sm text-warning">Google Maps API key missing — set VITE_GOOGLE_MAPS_API_KEY in .env.development.local.</p>
      )}

      <div className="rounded-xl border border-border bg-bg-surface px-4">
        {families.map((f) => (
          <FamilyRow key={f.enrolmentId} family={f} />
        ))}
      </div>

    </div>
  );
}

/** A launched school: how its offers are going. */
function LaunchedRow({ school }: { school: LaunchedSchool }) {
  const answered = school.accepted + school.declined + school.expired;
  const total = answered + school.offered;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-text-primary">{school.name}</p>
        <p className="text-xs text-text-muted">
          {school.routes} route{school.routes === 1 ? "" : "s"}
          {school.startsOn && ` · starts ${new Date(school.startsOn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
          {school.offersOpenUntil &&
            ` · offers open until ${new Date(school.offersOpenUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs">
        <span className="rounded-full bg-success-bg px-2 py-0.5 text-success">{school.accepted} confirmed</span>
        <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-neutral">{school.offered} waiting</span>
        {school.declined > 0 && <span className="rounded-full bg-warning-bg px-2 py-0.5 text-warning">{school.declined} declined</span>}
        {school.expired > 0 && <span className="rounded-full bg-danger-bg px-2 py-0.5 text-danger">{school.expired} expired</span>}
        <span className="text-text-muted">of {total}</span>
      </div>
    </div>
  );
}

/**
 * Our fleet's demand board: families who asked for a school our vans don't go to yet, grouped by
 * that school. One decision per school ("start running vans there?") instead of one approval per
 * family. Only for our own fleet (an OPERATOR tenant).
 */
export function DemandPage() {
  const { principal } = useAuth();
  const tenant = useTenant(principal!.tenantId);
  const isFleet = tenant.data?.type === "OPERATOR";
  const board = useDemandBoard(isFleet);
  const [selected, setSelected] = useState<string | null>(null);
  const schools = board.data?.schools ?? [];
  const current = selected ?? schools[0]?.schoolRef ?? null;

  if (tenant.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!isFleet) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Demand</h1>
        <p className="mt-1 text-sm text-text-muted">The demand board is for our own fleet's operations team.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Demand</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
          Families waiting for a school our vans don't go to yet, grouped by school — best launch candidates first.
          <Tooltip
            trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
            content={`A school is ready to launch once ${board.data?.launchMinChildren ?? "enough"} children with fresh interest are waiting. Vans assume ${board.data?.vanSeats ?? 12} seats. "Clustered" is the share of families living within 2 km of the middle of the group. Families who haven't opened the app or changed their request for ${board.data?.staleAfterDays ?? 60} days count as stale: they're left out of every number here, and at launch they only get a seat that's left over near them. After ${board.data?.closeAfterDays ?? 90} days their spot closes by itself (they can rejoin from the app).`}
          />
        </p>
      </div>

      {(board.data?.launched.length ?? 0) > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-text-primary">Launched</h2>
          <div className="rounded-xl border border-border bg-bg-surface px-4">
            {board.data!.launched.map((l) => (
              <LaunchedRow key={l.schoolRef} school={l} />
            ))}
          </div>
        </div>
      )}

      {board.isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : schools.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-surface p-8 text-center">
          <p className="text-sm text-text-primary">No one is waiting right now.</p>
          <p className="mt-1 text-sm text-text-muted">
            When parents choose a school our vans don't serve, they join its waitlist and show up here.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-text-muted">
            {board.data!.totalFamilies} families · {board.data!.totalChildren} children waiting across {schools.length} school
            {schools.length === 1 ? "" : "s"}
            {board.data!.staleFamilies > 0 && ` · +${board.data!.staleFamilies} stale, not counted`}
          </p>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              {schools.map((s) => (
                <SchoolCard
                  key={s.schoolRef}
                  school={s}
                  selected={s.schoolRef === current}
                  launchMin={board.data!.launchMinChildren}
                  onSelect={() => setSelected(s.schoolRef)}
                />
              ))}
            </div>
            {current && <SchoolDetail schoolRef={current} />}
          </div>
        </>
      )}
    </div>
  );
}
