// Mirrors the backend's DTOs field-for-field (stop/StopDtos.kt, vehicle/VehicleDtos.kt,
// route/RouteDtos.kt). Keep these in sync by hand — there's no shared schema/codegen yet.

export interface Stop {
  id: string;
  tenantId: string;
  name: string;
  lat: number;
  lng: number;
  geofenceM: number;
  createdAt: string;
  /** Created by the stop-request auto-resolver on a road a bus already drives. */
  autoCreated: boolean;
  /** Null while an auto-created stop is still waiting for an admin to check it. */
  confirmedAt: string | null;
}

/** Admin's check of an auto-created stop: keep or adjust name and spot, then confirm. */
export interface ConfirmStopRequest {
  name: string;
  lat: number;
  lng: number;
}

export interface CreateStopRequest {
  tenantId: string;
  name: string;
  lat: number;
  lng: number;
  geofenceM?: number;
}

export interface UpdateStopRequest {
  name: string;
  lat: number;
  lng: number;
  geofenceM?: number;
}

export interface BulkCreateStopRow {
  name: string;
  lat: number;
  lng: number;
  geofenceM?: number;
}

export interface BulkCreateStopsRequest {
  tenantId: string;
  stops: BulkCreateStopRow[];
}

export interface BulkCreateStopFailure {
  index: number;
  name: string;
  message: string;
}

export interface BulkCreateStopsResponse {
  created: Stop[];
  failed: BulkCreateStopFailure[];
}

export interface VehicleType {
  id: string;
  tenantId: string;
  name: string;
  /** How many extra students a vehicle of this type can take standing, once its own `seats`
   *  (a per-vehicle field) is full. A policy for the whole category, not tuned per vehicle. */
  graceSeats: number;
  createdAt: string;
}

export interface CreateVehicleTypeRequest {
  tenantId: string;
  name: string;
  graceSeats: number;
}

export interface UpdateVehicleTypeRequest {
  name: string;
  graceSeats: number;
}

export interface Vehicle {
  id: string;
  tenantId: string;
  regNo: string;
  vehicleTypeId: string;
  vehicleTypeName: string;
  seats: number;
  /** This vehicle's regular driver/co-driver, tracked separately per LEG — a persistent roster
   *  assignment, independent of whichever driver a given Ride actually picks. The morning and
   *  evening legs are fully independent: the same driver can be assigned to a DIFFERENT vehicle
   *  in each leg at once. Any of these eight can be unassigned. */
  morningDriverId: string | null;
  morningDriverName: string | null;
  morningCoDriverId: string | null;
  morningCoDriverName: string | null;
  eveningDriverId: string | null;
  eveningDriverName: string | null;
  eveningCoDriverId: string | null;
  eveningCoDriverName: string | null;
  /** Where this vehicle's driver starts the morning run and returns to after the evening run —
   *  treated as "stop 0" of every route it runs. All three null together until configured. */
  depotName: string | null;
  depotLat: number | null;
  depotLng: number | null;
  createdAt: string;
}

export interface CreateVehicleRequest {
  tenantId: string;
  regNo: string;
  vehicleTypeId: string;
  seats: number;
  morningDriverId?: string | null;
  morningCoDriverId?: string | null;
  eveningDriverId?: string | null;
  eveningCoDriverId?: string | null;
  /** All three or none — the backend rejects a partially-filled depot. */
  depotName?: string | null;
  depotLat?: number | null;
  depotLng?: number | null;
}

export interface UpdateVehicleRequest {
  regNo: string;
  vehicleTypeId: string;
  seats: number;
  morningDriverId?: string | null;
  morningCoDriverId?: string | null;
  eveningDriverId?: string | null;
  eveningCoDriverId?: string | null;
  depotName?: string | null;
  depotLat?: number | null;
  depotLng?: number | null;
}

export interface BulkCreateVehicleRow {
  regNo: string;
  /** Matched case-insensitively against the tenant's existing vehicle types; a name with no
   *  match is auto-created as a new type server-side. */
  typeName: string;
  seats: number;
}

export interface BulkCreateVehiclesRequest {
  tenantId: string;
  vehicles: BulkCreateVehicleRow[];
}

export interface BulkCreateVehicleFailure {
  index: number;
  regNo: string;
  message: string;
}

export interface BulkCreateVehiclesResponse {
  created: Vehicle[];
  failed: BulkCreateVehicleFailure[];
}

export interface Driver {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  createdAt: string;
  /** Which vehicle (if any) this driver is currently assigned to, per leg and role. The morning
   *  and evening legs are independent, so more than one of these four can be set at once, each
   *  pointing at a different vehicle. */
  morningVehicleId: string | null;
  morningVehicleRegNo: string | null;
  morningCoDriverOfVehicleId: string | null;
  morningCoDriverOfVehicleRegNo: string | null;
  eveningVehicleId: string | null;
  eveningVehicleRegNo: string | null;
  eveningCoDriverOfVehicleId: string | null;
  eveningCoDriverOfVehicleRegNo: string | null;
}

export interface CreateDriverRequest {
  tenantId: string;
  name: string;
  phone: string;
}

export interface UpdateDriverRequest {
  name: string;
  phone: string;
}

export interface BulkCreateDriverRow {
  name: string;
  phone: string;
}

export interface BulkCreateDriversRequest {
  tenantId: string;
  drivers: BulkCreateDriverRow[];
}

export interface BulkCreateDriverFailure {
  index: number;
  name: string;
  message: string;
}

export interface BulkCreateDriversResponse {
  created: Driver[];
  failed: BulkCreateDriverFailure[];
}

export interface RouteStopView {
  stopId: string;
  stopName: string;
  position: number;
  /** Real road distance/duration to the NEXT point — the next stop, or the destination school
   *  for the last stop. Null only if the Google Routes lookup failed/was skipped (see backend
   *  routing/GoogleRoutesClient.kt). */
  roadDistanceToNextM: number | null;
  roadDurationToNextS: number | null;
  /** Google's encoded polyline for the real road path to the next point — decode with
   *  `google.maps.geometry.encoding.decodePath` to draw the actual route shape. Same
   *  nullability as the two fields above. */
  roadPolylineToNext: string | null;
}

export interface Route {
  id: string;
  tenantId: string;
  name: string;
  vehicleId: string;
  /** This route's vehicle's depot, denormalized so the map/preview don't need a second fetch
   *  just to draw "stop 0" — null together whenever the vehicle has no depot set. */
  /** Morning departure, school-local "HH:mm"; null = backend default (07:00). Not editable in this app yet. */
  morningStartTime: string | null;
  /** The school this route goes to (our fleet runs to several). */
  schoolId: string | null;
  vehicleDepotName: string | null;
  vehicleDepotLat: number | null;
  vehicleDepotLng: number | null;
  /** The depot → first-stop leg — same meaning/nullability as a RouteStopView's own
   *  roadDistanceToNextM/etc, just not attached to any particular stop. */
  depotDistanceToFirstStopM: number | null;
  depotDurationToFirstStopS: number | null;
  depotPolylineToFirstStop: string | null;
  stops: RouteStopView[];
  createdAt: string;
}

export interface CreateRouteRequest {
  tenantId: string;
  name: string;
  vehicleId: string;
  stopIdsInOrder: string[];
  /** Our fleet: which of its schools this route goes to. Default = the tenant's first school. */
  schoolId?: string;
}

export interface UpdateRouteRequest {
  name: string;
  vehicleId: string;
  stopIdsInOrder: string[];
}

export interface School {
  id: string;
  tenantId: string;
  name: string;
  lat: number;
  lng: number;
  geofenceM: number;
  /** The school's Google Maps listing — how parents' picks at sign-up are recognised. */
  googlePlaceId: string | null;
  createdAt: string;
}

export interface CreateSchoolRequest {
  tenantId: string;
  name: string;
  lat: number;
  lng: number;
  geofenceM?: number;
}

export interface UpdateSchoolRequest {
  name: string;
  lat: number;
  lng: number;
  geofenceM?: number;
}

export interface Tenant {
  id: string;
  name: string;
  timezone: string;
  /** The tenant-wide fallback invite code, shown in Settings → General — distinct from each
   *  parent's own personal code (Parent.inviteCode below). */
  inviteCode: string;
  /** SCHOOL, or OPERATOR = our own fleet (run like a school, but no roster). */
  type: 'SCHOOL' | 'OPERATOR';
  /** A = the school pays per student; B = parents pay a monthly plan in the app. */
  billingModel: 'A' | 'B';
  createdAt: string;
}

export interface UpdateTenantRequest {
  name: string;
}

export interface SchoolClass {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
}

export interface CreateSchoolClassRequest {
  tenantId: string;
  name: string;
}

export interface UpdateSchoolClassRequest {
  name: string;
}

export interface Section {
  id: string;
  classId: string;
  className: string;
  name: string;
  createdAt: string;
}

export interface CreateSectionRequest {
  classId: string;
  name: string;
}

export interface UpdateSectionRequest {
  name: string;
}

export type GuardianRelation = "FATHER" | "MOTHER" | "GUARDIAN" | "OTHER";

/** Links an EXISTING parent (picked via a search-by-name box, never typed inline — Parents are
 *  their own managed resource, see the Parents tab) to a student, with a relation.
 *  Father/Mother/Guardian/Other, case-insensitive — matched server-side against
 *  GuardianRelation (see backend ChildService.parseRelation). */
export interface GuardianLink {
  parentId: string;
  relation: string;
}

export interface GuardianResponse {
  parentId: string;
  firstName: string;
  lastName: string | null;
  /** Convenience for display — firstName + lastName, not independently editable. */
  name: string;
  phone: string;
  relation: GuardianRelation;
  inviteCode: string;
  invitedAt: string | null;
}

export interface Student {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string | null;
  /** Convenience for display — firstName + lastName, not independently editable. */
  name: string;
  dob: string | null;
  admissionNo: string;
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  /** Null until assigned via Update — a student doesn't need a stop at import time, same
   *  precedent as a Vehicle not needing a driver at import time. */
  assignedStopId: string | null;
  assignedStopName: string | null;
  guardians: GuardianResponse[];
  createdAt: string;
}

export interface CreateStudentRequest {
  tenantId: string;
  firstName: string;
  lastName?: string | null;
  dob?: string | null;
  admissionNo: string;
  sectionId: string;
  assignedStopId?: string | null;
  /** 1 or 2 guardians, required at creation — see backend CreateChildRequest. */
  guardians: GuardianLink[];
}

export interface UpdateStudentRequest {
  firstName: string;
  lastName?: string | null;
  dob?: string | null;
  admissionNo: string;
  sectionId: string;
  assignedStopId?: string | null;
}

export interface BulkCreateStudentRow {
  firstName: string;
  lastName?: string;
  admissionNo: string;
  className: string;
  sectionName: string;
  parent1FirstName: string;
  parent1LastName?: string;
  parent1Phone: string;
  parent1Relation: string;
  parent2FirstName?: string;
  parent2LastName?: string;
  parent2Phone?: string;
  parent2Relation?: string;
}

export interface BulkCreateStudentsRequest {
  tenantId: string;
  children: BulkCreateStudentRow[];
}

export interface BulkCreateStudentFailure {
  index: number;
  studentName: string;
  message: string;
}

export interface BulkCreateStudentsResponse {
  created: Student[];
  failed: BulkCreateStudentFailure[];
}

export interface ParentChildSummary {
  childId: string;
  name: string;
  className: string;
  sectionName: string;
  relation: string;
}

export interface Parent {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string | null;
  /** Convenience for display — firstName + lastName, not independently editable. */
  name: string;
  phone: string;
  /** This parent's personal code for the WhatsApp "download the app, enter this code" flow —
   *  see Tenant.inviteCode for the separate tenant-wide fallback. */
  inviteCode: string;
  invitedAt: string | null;
  children: ParentChildSummary[];
  createdAt: string;
}

export interface CreateParentRequest {
  tenantId: string;
  firstName: string;
  lastName?: string | null;
  phone: string;
}

export interface UpdateParentRequest {
  firstName: string;
  lastName?: string | null;
  phone: string;
}

export interface BulkSendInvitesResponse {
  sent: number;
}

export type StopRequestType = "EXISTING_STOP" | "NEW_STOP";
/** COUNTER_PROPOSED: admin suggested a different location than the parent's NEW_STOP proposal
 *  (see StopRequest.counterProposed* below) and it's sitting with the parent for their answer. */
export type StopRequestStatus = "PENDING" | "COUNTER_PROPOSED" | "APPROVED" | "REJECTED";

export interface NearbyRouteOption {
  routeId: string;
  routeName: string;
  vehicleId: string;
  vehicleRegNo: string;
  vehicleTypeName: string;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  /** Null for an EXISTING_STOP request (the route already stops there) — only set for a
   *  NEW_STOP proposal, the distance from the proposed location to this route's nearest stop. */
  distanceFromProposedM: number | null;
  /** True once this route has real ride history — its stop order can no longer be changed
   *  (see backend RouteService.update()'s kdoc), so "attach to this route" must be disabled. */
  hasRideHistory: boolean;
  /** This route vehicle type's configured standing capacity — see VehicleType.graceSeats. */
  graceSeats: number;
  /** How many of `graceSeats` are still free. Pair with `availableSeats <= 0` to mean "full, but
   *  can still take one more standing." */
  graceAvailable: number;
}

export type ReviewReason =
  | "NEW_LOCATION"
  | "NO_ROUTE_SERVES_STOP"
  | "ROUTE_FULL"
  | "NO_ROUTE_AVAILABLE"
  | "REVERTED_BY_ADMIN"
  | "DETOUR_TOO_LONG";

/** Which option the auto-resolver took for an approved request. */
export type Resolution =
  | "EXISTING_STOP_REQUESTED"
  | "WALK_EXISTING_STOP"
  | "WALK_NEW_STOP"
  | "DETOUR_STOP"
  | "GROUP_DETOUR_STOP";

export interface AutoResolveSummary {
  approved: number;
  stillPending: number;
}

export interface StopRequest {
  id: string;
  tenantId: string;
  childId: string;
  childName: string;
  admissionNo: string;
  className: string;
  sectionName: string;
  parentId: string;
  parentName: string;
  parentPhone: string;
  type: StopRequestType;
  existingStopId: string | null;
  existingStopName: string | null;
  proposedName: string | null;
  proposedLat: number | null;
  proposedLng: number | null;
  /** Set only while status === "COUNTER_PROPOSED" — the admin's suggested alternative to
   *  proposedName/Lat/Lng, awaiting the parent's answer. */
  counterProposedName: string | null;
  counterProposedLat: number | null;
  counterProposedLng: number | null;
  /** Set iff a route was picked while suggesting the alternate — the new stop joins its run the
   *  moment the parent accepts. Null if the admin didn't attach one. */
  counterProposedRouteId: string | null;
  counterProposedRouteName: string | null;
  status: StopRequestStatus;
  adminNote: string | null;
  /** True iff this was approved into a grace (standing) seat rather than a normal one. */
  viaGraceSeat: boolean;
  /** True iff the system approved this on its own, not an admin. */
  autoApproved: boolean;
  /** True iff that auto-approval created `resultStop` (on a bus's road, or as a detour stop). */
  autoCreatedStop: boolean;
  /** Which option the auto-resolver took. */
  resolution: Resolution | null;
  /** Real walking distance/time from the home pin to the assigned stop. */
  walkDistanceM: number | null;
  walkDurationS: number | null;
  /** Extra bus time a detour stop added — or, for a request in review, would add. */
  detourS: number | null;
  /** Families sharing a group detour stop, this one included. */
  groupSize: number | null;
  /** Why a PENDING request is waiting on an admin; null once resolved. */
  reviewReason: ReviewReason | null;
  /** NEW_STOP snapped to an existing stop: metres between the parent's pin and that stop. */
  snappedDistanceM: number | null;
  /** NEW_STOP needing review: least-detour route + 0-based run-order slot, precomputed when the
   *  request arrived. Detour seconds are real-road, null if Google couldn't say. */
  suggestedRouteId: string | null;
  suggestedRouteName: string | null;
  suggestedInsertPosition: number | null;
  suggestedDetourM: number | null;
  suggestedDetourS: number | null;
  resultStopId: string | null;
  resultStopName: string | null;
  /** Computed fresh by the backend on every read — which existing routes/buses are closest
   *  (or already serve the picked stop) and how much room they currently have. */
  nearbyRoutes: NearbyRouteOption[];
  createdAt: string;
  resolvedAt: string | null;
}

export interface ApproveStopRequestRequest {
  adminNote?: string | null;
  /** Only meaningful for a NEW_STOP approval — attach the newly created stop to this route's
   *  run order right away. Requires `existingStopIdsInOrder` and `insertPosition` too. */
  routeId?: string;
  /** This route's current stops, in the final desired order (reordered if the admin chose to)
   *  — NOT including the new stop itself. */
  existingStopIdsInOrder?: string[];
  /** 0-based position within the final route where the new stop should be inserted. */
  insertPosition?: number;
  /** Approve this into one of the route's grace (standing) seats instead of a normal one — only
   *  meaningful once the relevant route's `availableSeats <= 0`. When set and `adminNote` is
   *  left blank, the backend fills in a default parent-facing explanation automatically. */
  viaGraceSeat?: boolean;
}

export interface RejectStopRequestRequest {
  adminNote: string;
}

/** Admin-only — suggests a different location than what the parent proposed. Only valid for a
 *  PENDING NEW_STOP request. */
export interface CounterProposeStopRequestRequest {
  counterProposedName: string;
  counterProposedLat: number;
  counterProposedLng: number;
  /** Shown back as this request's adminNote — e.g. explaining why the original spot doesn't
   *  work for the bus. */
  adminNote?: string | null;
  /** Optional: attach the eventual stop to this route's run the moment the parent accepts.
   *  Requires `insertPosition` too. */
  routeId?: string;
  /** 0-based position, among `routeId`'s stops as they stand right now, where the new stop
   *  would land — re-checked against the route's current stop count when the parent actually
   *  accepts, since that may be a while from now. */
  insertPosition?: number;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface PlannedStop {
  stopId: string;
  name: string;
  /** Set when the re-plan moves this stop here from another route. */
  movedFromRouteName: string | null;
}

export interface RoutePlan {
  routeId: string;
  routeName: string;
  /** Has ride history — its stop order is frozen, nothing proposed. */
  locked: boolean;
  changed: boolean;
  currentStops: PlannedStop[];
  proposedStops: PlannedStop[];
  /** Stops moved off this route: { first: stop name, second: destination route name }. */
  movedOut: { first: string; second: string }[];
  currentDriveS: number | null;
  proposedDriveS: number | null;
  currentRideS: number | null;
  proposedRideS: number | null;
}

export interface RoutePlanResponse {
  routes: RoutePlan[];
  totalSavedS: number;
  notes: string[];
}

export interface ApplyRoutePlanRequest {
  tenantId: string;
  changes: { routeId: string; stopIdsInOrder: string[] }[];
}

// --- Fleet demand board (our own fleet: waitlisted families grouped by school) ---

export interface DemandSchool {
  schoolRef: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** Fresh demand only — every number on the card counts families who showed interest recently. */
  families: number;
  children: number;
  basicChildren: number;
  premiumChildren: number;
  /** What these families would pay a month, GST included. */
  monthlyRevenueInr: number;
  vansNeeded: number;
  /** 0–1: share of families living close together (one route could collect them). */
  clusterShare: number;
  medianDistanceKm: number | null;
  oldestRequestDays: number;
  /** Quiet for `staleAfterDays` — not in the numbers above; offered only leftover seats. */
  staleFamilies: number;
  staleChildren: number;
  readyToLaunch: boolean;
}

export interface DemandBoard {
  schools: DemandSchool[];
  totalFamilies: number;
  totalChildren: number;
  staleFamilies: number;
  staleAfterDays: number;
  closeAfterDays: number;
  vanSeats: number;
  launchMinChildren: number;
  /** Schools already launched, and how their offers are going. */
  launched: LaunchedSchool[];
}

export interface LaunchedSchool {
  schoolRef: string;
  name: string;
  startsOn: string | null;
  routes: number;
  offered: number;
  accepted: number;
  declined: number;
  expired: number;
  offersOpenUntil: string | null;
}

// --- Launching a school (phase 2) ---

export interface PlannedFamily {
  enrolmentId: string;
  parentName: string;
  children: number;
  walkM: number;
  /** Gone quiet: given a seat only because one was left over near them. */
  stale: boolean;
}

export interface PlannedStop {
  name: string;
  lat: number;
  lng: number;
  children: number;
  families: PlannedFamily[];
}

export interface PlannedRoute {
  name: string;
  stops: PlannedStop[];
  children: number;
}

export interface VehicleOption {
  id: string;
  regNo: string;
  seats: number;
  type: string;
  /** Not already running a route. */
  free: boolean;
}

export interface LaunchPlan {
  schoolRef: string;
  schoolName: string;
  schoolLat: number | null;
  schoolLng: number | null;
  routes: PlannedRoute[];
  families: number;
  children: number;
  vanSeats: number;
  stopMergeM: number;
  leftOut: string[];
  /** Stale families with no seat left near them — not offered, still waiting. */
  staleNotOffered: string[];
  vehicles: VehicleOption[];
}

export interface LaunchRequest {
  startsOn: string;
  offerDays: number;
  morningStartTime?: string;
  stopMergeM?: number;
  vehicleIds: string[];
}

export interface LaunchResult {
  schoolId: string;
  schoolName: string;
  startsOn: string;
  routes: { routeId: string; name: string; stops: number; children: number; vehicleRegNo: string }[];
  offersSent: number;
  offerExpiresAt: string;
}

export interface DemandFamily {
  enrolmentId: string;
  parentName: string;
  phone: string;
  children: { name: string; className: string; sectionName: string | null }[];
  homeLat: number;
  homeLng: number;
  homeAddress: string | null;
  plan: "BASIC" | "PREMIUM" | null;
  monthlyTotalInr: number | null;
  requestedAt: string;
  interestConfirmedAt: string | null;
  stale: boolean;
}

export interface DemandSchoolDetail {
  school: DemandSchool;
  families: DemandFamily[];
}
