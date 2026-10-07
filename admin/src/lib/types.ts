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
  createdAt: string;
}

export interface CreateVehicleTypeRequest {
  tenantId: string;
  name: string;
}

export interface UpdateVehicleTypeRequest {
  name: string;
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
}

export interface UpdateVehicleRequest {
  regNo: string;
  vehicleTypeId: string;
  seats: number;
  morningDriverId?: string | null;
  morningCoDriverId?: string | null;
  eveningDriverId?: string | null;
  eveningCoDriverId?: string | null;
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
  stops: RouteStopView[];
  createdAt: string;
}

export interface CreateRouteRequest {
  tenantId: string;
  name: string;
  vehicleId: string;
  stopIdsInOrder: string[];
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

export interface ApiError {
  code: string;
  message: string;
}
