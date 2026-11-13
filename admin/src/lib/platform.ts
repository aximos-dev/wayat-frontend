import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// Mirrors the backend's platform/PlatformDtos.kt, field for field.

export interface PlatformMe {
  id: string;
  name: string;
  phone: string;
}

export interface PlatformTenant {
  id: string;
  name: string;
  type: "SCHOOL" | "OPERATOR";
  billingModel: "A" | "B";
  inviteCode: string;
  timezone: string;
  schools: number;
  routes: number;
  vehicles: number;
  drivers: number;
  children: number;
  admins: number;
  pendingRequests: number;
  waitlisted: number;
}

export interface CreatePlatformTenantRequest {
  name: string;
  type: "SCHOOL" | "OPERATOR";
  billingModel?: "A" | "B";
  adminName: string;
  adminPhone: string;
}

export interface PlatformAdminUser {
  id: string;
  name: string;
  phone: string;
}

export interface FleetStopPoint {
  name: string;
  lat: number;
  lng: number;
}

export type RideState = "SCHEDULED" | "IN_PROGRESS" | "AT_SCHOOL" | "COMPLETED" | "CANCELLED";

export interface FleetRoute {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  schoolId: string | null;
  schoolName: string | null;
  vehicleId: string;
  vehicleRegNo: string;
  seats: number;
  graceSeats: number;
  driverName: string | null;
  children: number;
  seatsFree: number;
  morningStartTime: string | null;
  startsOn: string | null;
  todayRideId: string | null;
  todayRideState: RideState | null;
  stops: FleetStopPoint[];
}

export interface FleetSchool {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  lat: number;
  lng: number;
  routes: number;
  vans: number;
  seats: number;
  children: number;
  seatsFree: number;
}

export interface FleetVehicle {
  id: string;
  regNo: string;
  tenantId: string;
  tenantName: string;
  seats: number;
  driverName: string | null;
  routes: { id: string; name: string; schoolName: string | null }[];
}

export interface FleetOverview {
  schools: FleetSchool[];
  routes: FleetRoute[];
  vehicles: FleetVehicle[];
}

export interface ReassignVanResult {
  changed: FleetRoute[];
  swapped: boolean;
}

export function usePlatformMe(enabled: boolean) {
  return useQuery({
    queryKey: ["platform", "me"],
    enabled,
    queryFn: async () => (await api.get<PlatformMe>("/v1/platform/me")).data,
  });
}

export function usePlatformTenants(enabled = true) {
  return useQuery({
    queryKey: ["platform", "tenants"],
    enabled,
    queryFn: async () => (await api.get<PlatformTenant[]>("/v1/platform/tenants")).data,
  });
}

export function useCreatePlatformTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreatePlatformTenantRequest) =>
      (await api.post<PlatformTenant>("/v1/platform/tenants", request)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] }),
  });
}

export function useTenantAdmins(tenantId: string) {
  return useQuery({
    queryKey: ["platform", "admins", tenantId],
    queryFn: async () => (await api.get<PlatformAdminUser[]>(`/v1/platform/tenants/${tenantId}/admins`)).data,
  });
}

export function useAddTenantAdmin(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: { name: string; phone: string }) =>
      (await api.post<PlatformAdminUser>(`/v1/platform/tenants/${tenantId}/admins`, request)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["platform", "admins", tenantId] });
      void queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
    },
  });
}

export function useFleetOverview() {
  return useQuery({
    queryKey: ["platform", "fleet"],
    queryFn: async () => (await api.get<FleetOverview>("/v1/platform/fleet")).data,
  });
}

export function useReassignVan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ routeId, vehicleId }: { routeId: string; vehicleId: string }) =>
      (await api.put<ReassignVanResult>(`/v1/platform/routes/${routeId}/vehicle`, { vehicleId })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "fleet"] }),
  });
}
