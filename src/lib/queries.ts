import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  CreateRouteRequest,
  CreateStopRequest,
  CreateVehicleRequest,
  Route,
  Stop,
  Vehicle,
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
