import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  BulkCreateDriversRequest,
  BulkCreateDriversResponse,
  BulkCreateStopsRequest,
  BulkCreateStopsResponse,
  BulkCreateVehiclesRequest,
  BulkCreateVehiclesResponse,
  CreateDriverRequest,
  CreateRouteRequest,
  CreateSchoolRequest,
  CreateStopRequest,
  CreateVehicleRequest,
  CreateVehicleTypeRequest,
  Driver,
  Route,
  School,
  Stop,
  UpdateDriverRequest,
  UpdateRouteRequest,
  UpdateSchoolRequest,
  UpdateStopRequest,
  UpdateVehicleRequest,
  UpdateVehicleTypeRequest,
  Vehicle,
  VehicleType,
} from "./types";

// --- Stops ---

export function useStops(tenantId: string) {
  return useQuery({
    queryKey: ["stops", tenantId],
    queryFn: async () => (await api.get<Stop[]>("/v1/stops", { params: { tenantId } })).data,
  });
}

export function useCreateStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateStopRequest) =>
      (await api.post<Stop>("/v1/stops", request)).data,
    onSuccess: (stop) => {
      queryClient.invalidateQueries({ queryKey: ["stops", stop.tenantId] });
    },
  });
}

export function useUpdateStop(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stopId, request }: { stopId: string; request: UpdateStopRequest }) =>
      (await api.put<Stop>(`/v1/stops/${stopId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stops", tenantId] });
    },
  });
}

export function useBulkCreateStops(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: BulkCreateStopsRequest) =>
      (await api.post<BulkCreateStopsResponse>("/v1/stops/bulk", request)).data,
    onSuccess: (result) => {
      if (result.created.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["stops", tenantId] });
      }
    },
  });
}

export function useDeleteStop(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stopId: string) => {
      await api.delete(`/v1/stops/${stopId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stops", tenantId] });
    },
  });
}

// --- School ---
// One school per tenant — the backend's GET /v1/schools already scopes to the caller's own
// tenant (see SchoolService.listAll), so there's no tenantId query param. `tenantId` here is
// only used to key the cache per logged-in tenant.

export function useSchool(tenantId: string) {
  return useQuery({
    queryKey: ["school", tenantId],
    queryFn: async () => {
      const schools = (await api.get<School[]>("/v1/schools")).data;
      return schools[0] ?? null;
    },
  });
}

export function useCreateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateSchoolRequest) =>
      (await api.post<School>("/v1/schools", request)).data,
    onSuccess: (school) => {
      queryClient.invalidateQueries({ queryKey: ["school", school.tenantId] });
    },
  });
}

export function useUpdateSchool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ schoolId, request }: { schoolId: string; request: UpdateSchoolRequest }) =>
      (await api.put<School>(`/v1/schools/${schoolId}`, request)).data,
    onSuccess: (school) => {
      queryClient.invalidateQueries({ queryKey: ["school", school.tenantId] });
    },
  });
}

// --- Vehicle types ---
// Tenant-managed taxonomy (Van, Mini Van, Bus, ...) — a vehicle's `type` used to be a free-text
// string; it's now a real reference entity, same duplicate-name/in-use-blocks-delete shape as
// Stop.

export function useVehicleTypes(tenantId: string) {
  return useQuery({
    queryKey: ["vehicleTypes", tenantId],
    queryFn: async () => (await api.get<VehicleType[]>("/v1/vehicle-types", { params: { tenantId } })).data,
  });
}

export function useCreateVehicleType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateVehicleTypeRequest) =>
      (await api.post<VehicleType>("/v1/vehicle-types", request)).data,
    onSuccess: (vehicleType) => {
      queryClient.invalidateQueries({ queryKey: ["vehicleTypes", vehicleType.tenantId] });
    },
  });
}

export function useUpdateVehicleType(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleTypeId, request }: { vehicleTypeId: string; request: UpdateVehicleTypeRequest }) =>
      (await api.put<VehicleType>(`/v1/vehicle-types/${vehicleTypeId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicleTypes", tenantId] });
    },
  });
}

export function useDeleteVehicleType(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vehicleTypeId: string) => {
      await api.delete(`/v1/vehicle-types/${vehicleTypeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicleTypes", tenantId] });
    },
  });
}

// --- Vehicles ---

export function useVehicles(tenantId: string) {
  return useQuery({
    queryKey: ["vehicles", tenantId],
    queryFn: async () => (await api.get<Vehicle[]>("/v1/vehicles", { params: { tenantId } })).data,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateVehicleRequest) =>
      (await api.post<Vehicle>("/v1/vehicles", request)).data,
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", vehicle.tenantId] });
      // A create/update that assigns a driver/co-driver may have auto-unassigned them from
      // another vehicle (see VehicleService.resolveDriverAssignment) — that other vehicle's
      // own row, and both drivers' assignment info, need a refetch too.
      queryClient.invalidateQueries({ queryKey: ["drivers", vehicle.tenantId] });
    },
  });
}

export function useBulkCreateVehicles(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: BulkCreateVehiclesRequest) =>
      (await api.post<BulkCreateVehiclesResponse>("/v1/vehicles/bulk", request)).data,
    onSuccess: (result) => {
      if (result.created.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["vehicles", tenantId] });
        // A row with a brand-new type name auto-creates that VehicleType server-side.
        queryClient.invalidateQueries({ queryKey: ["vehicleTypes", tenantId] });
      }
    },
  });
}

export function useUpdateVehicle(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleId, request }: { vehicleId: string; request: UpdateVehicleRequest }) =>
      (await api.put<Vehicle>(`/v1/vehicles/${vehicleId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["drivers", tenantId] });
    },
  });
}

export function useDeleteVehicle(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vehicleId: string) => {
      await api.delete(`/v1/vehicles/${vehicleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles", tenantId] });
    },
  });
}

// --- Drivers ---

export function useDrivers(tenantId: string) {
  return useQuery({
    queryKey: ["drivers", tenantId],
    queryFn: async () => (await api.get<Driver[]>("/v1/drivers", { params: { tenantId } })).data,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateDriverRequest) =>
      (await api.post<Driver>("/v1/drivers", request)).data,
    onSuccess: (driver) => {
      queryClient.invalidateQueries({ queryKey: ["drivers", driver.tenantId] });
    },
  });
}

export function useBulkCreateDrivers(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: BulkCreateDriversRequest) =>
      (await api.post<BulkCreateDriversResponse>("/v1/drivers/bulk", request)).data,
    onSuccess: (result) => {
      if (result.created.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["drivers", tenantId] });
      }
    },
  });
}

export function useUpdateDriver(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ driverId, request }: { driverId: string; request: UpdateDriverRequest }) =>
      (await api.put<Driver>(`/v1/drivers/${driverId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers", tenantId] });
    },
  });
}

export function useDeleteDriver(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driverId: string) => {
      await api.delete(`/v1/drivers/${driverId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers", tenantId] });
    },
  });
}

// --- Routes ---

export function useRoutes(tenantId: string) {
  return useQuery({
    queryKey: ["routes", tenantId],
    queryFn: async () => (await api.get<Route[]>("/v1/routes", { params: { tenantId } })).data,
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateRouteRequest) =>
      (await api.post<Route>("/v1/routes", request)).data,
    onSuccess: (route) => {
      queryClient.invalidateQueries({ queryKey: ["routes", route.tenantId] });
    },
  });
}

export function useUpdateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ routeId, request }: { routeId: string; request: UpdateRouteRequest }) =>
      (await api.put<Route>(`/v1/routes/${routeId}`, request)).data,
    onSuccess: (route) => {
      queryClient.invalidateQueries({ queryKey: ["routes", route.tenantId] });
    },
  });
}

export function useDeleteRoute(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (routeId: string) => {
      await api.delete(`/v1/routes/${routeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes", tenantId] });
    },
  });
}
