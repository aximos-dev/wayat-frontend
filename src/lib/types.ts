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

export interface Vehicle {
  id: string;
  tenantId: string;
  regNo: string;
  type: string;
  seats: number;
  createdAt: string;
}

export interface CreateVehicleRequest {
  tenantId: string;
  regNo: string;
  type: string;
  seats: number;
}

export interface RouteStopView {
  stopId: string;
  stopName: string;
  position: number;
  /** Real road distance/duration to the NEXT stop — null for the last stop, or if the Google
   *  Routes lookup failed/was skipped (see backend routing/GoogleRoutesClient.kt). */
  roadDistanceToNextM: number | null;
  roadDurationToNextS: number | null;
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

export interface ApiError {
  code: string;
  message: string;
}
