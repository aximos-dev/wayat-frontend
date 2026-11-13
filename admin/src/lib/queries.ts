import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  DemandBoard,
  LaunchPlan,
  LaunchRequest,
  LaunchResult,
  DemandSchoolDetail,
  ApplyRoutePlanRequest,
  RoutePlanResponse,
  ApproveStopRequestRequest,
  ConfirmStopRequest,
  AutoResolveSummary,
  BulkCreateDriversRequest,
  BulkCreateDriversResponse,
  BulkCreateStopsRequest,
  BulkCreateStopsResponse,
  BulkCreateStudentsRequest,
  BulkCreateStudentsResponse,
  BulkCreateVehiclesRequest,
  BulkCreateVehiclesResponse,
  BulkSendInvitesResponse,
  CounterProposeStopRequestRequest,
  CreateDriverRequest,
  CreateRouteRequest,
  CreateSchoolClassRequest,
  CreateSchoolRequest,
  CreateSectionRequest,
  CreateStopRequest,
  CreateStudentRequest,
  CreateVehicleRequest,
  CreateVehicleTypeRequest,
  Driver,
  CreateParentRequest,
  GuardianLink,
  Parent,
  RejectStopRequestRequest,
  Route,
  School,
  SchoolClass,
  Section,
  Stop,
  StopRequest,
  StopRequestStatus,
  Student,
  Tenant,
  UpdateDriverRequest,
  UpdateParentRequest,
  UpdateRouteRequest,
  UpdateSchoolClassRequest,
  UpdateSchoolRequest,
  UpdateSectionRequest,
  UpdateStopRequest,
  UpdateStudentRequest,
  UpdateTenantRequest,
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

// --- Tenant (General Settings: organization name + the tenant-wide fallback invite code) ---

export function useTenant(tenantId: string) {
  return useQuery({
    queryKey: ["tenant", tenantId],
    // A super admin on the platform pages has no tenant.
    enabled: tenantId !== "",
    queryFn: async () => (await api.get<Tenant>(`/v1/tenants/${tenantId}`)).data,
  });
}

export function useUpdateTenant(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: UpdateTenantRequest) =>
      (await api.put<Tenant>(`/v1/tenants/${tenantId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
  });
}

export function useRegenerateTenantInviteCode(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<Tenant>(`/v1/tenants/${tenantId}/invite-code/regenerate`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", tenantId] });
    },
  });
}

// --- School classes ---

export function useSchoolClasses(tenantId: string) {
  return useQuery({
    queryKey: ["schoolClasses", tenantId],
    queryFn: async () => (await api.get<SchoolClass[]>("/v1/school-classes", { params: { tenantId } })).data,
  });
}

export function useCreateSchoolClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateSchoolClassRequest) =>
      (await api.post<SchoolClass>("/v1/school-classes", request)).data,
    onSuccess: (schoolClass) => {
      queryClient.invalidateQueries({ queryKey: ["schoolClasses", schoolClass.tenantId] });
    },
  });
}

export function useUpdateSchoolClass(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, request }: { classId: string; request: UpdateSchoolClassRequest }) =>
      (await api.put<SchoolClass>(`/v1/school-classes/${classId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolClasses", tenantId] });
      // A renamed class's name is denormalized onto every one of its Sections.
      queryClient.invalidateQueries({ queryKey: ["sections", tenantId] });
    },
  });
}

export function useDeleteSchoolClass(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (classId: string) => {
      await api.delete(`/v1/school-classes/${classId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolClasses", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["sections", tenantId] });
    },
  });
}

// --- Sections ---
// Always fetched flattened across the whole tenant (one query, used both by the class/section
// manager and the Student form/importer) rather than per-class — see backend
// SectionController's tenantId-vs-classId kdoc.

export function useSections(tenantId: string) {
  return useQuery({
    queryKey: ["sections", tenantId],
    queryFn: async () => (await api.get<Section[]>("/v1/sections", { params: { tenantId } })).data,
  });
}

export function useCreateSection(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateSectionRequest) =>
      (await api.post<Section>("/v1/sections", request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections", tenantId] });
    },
  });
}

export function useUpdateSection(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sectionId, request }: { sectionId: string; request: UpdateSectionRequest }) =>
      (await api.put<Section>(`/v1/sections/${sectionId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections", tenantId] });
    },
  });
}

export function useDeleteSection(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sectionId: string) => {
      await api.delete(`/v1/sections/${sectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections", tenantId] });
    },
  });
}

// --- Students (backend: Child — see backend PROGRESS.md for why the name stays Child
// internally; "Student" is the user-facing word everywhere in this app) ---

export function useStudents(tenantId: string) {
  return useQuery({
    queryKey: ["students", tenantId],
    queryFn: async () => (await api.get<Student[]>("/v1/children", { params: { tenantId } })).data,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateStudentRequest) =>
      (await api.post<Student>("/v1/children", request)).data,
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ["students", student.tenantId] });
      // Guardians may have been resolved-or-created as new Parent rows.
      queryClient.invalidateQueries({ queryKey: ["parents", student.tenantId] });
    },
  });
}

export function useUpdateStudent(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, request }: { studentId: string; request: UpdateStudentRequest }) =>
      (await api.put<Student>(`/v1/children/${studentId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
    },
  });
}

export function useBulkCreateStudents(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: BulkCreateStudentsRequest) =>
      (await api.post<BulkCreateStudentsResponse>("/v1/children/bulk", request)).data,
    onSuccess: (result) => {
      if (result.created.length > 0) {
        queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
        queryClient.invalidateQueries({ queryKey: ["parents", tenantId] });
        // A row with a brand-new class/section name auto-creates those server-side.
        queryClient.invalidateQueries({ queryKey: ["schoolClasses", tenantId] });
        queryClient.invalidateQueries({ queryKey: ["sections", tenantId] });
      }
    },
  });
}

export function useAddGuardian(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, request }: { studentId: string; request: GuardianLink }) =>
      (await api.post<Student>(`/v1/children/${studentId}/guardians`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["parents", tenantId] });
    },
  });
}

export function useRemoveGuardian(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, parentId }: { studentId: string; parentId: string }) =>
      (await api.delete<Student>(`/v1/children/${studentId}/guardians/${parentId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["parents", tenantId] });
    },
  });
}

export function useDeleteStudent(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) => {
      await api.delete(`/v1/children/${studentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
    },
  });
}

// --- Parents ---

export function useParents(tenantId: string) {
  return useQuery({
    queryKey: ["parents", tenantId],
    queryFn: async () => (await api.get<Parent[]>("/v1/parents", { params: { tenantId } })).data,
  });
}

export function useCreateParent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateParentRequest) =>
      (await api.post<Parent>("/v1/parents", request)).data,
    onSuccess: (parent) => {
      queryClient.invalidateQueries({ queryKey: ["parents", parent.tenantId] });
    },
  });
}

export function useUpdateParent(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ parentId, request }: { parentId: string; request: UpdateParentRequest }) =>
      (await api.put<Parent>(`/v1/parents/${parentId}`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parents", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
    },
  });
}

export function useSendParentInvite(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (parentId: string) =>
      (await api.post<Parent>(`/v1/parents/${parentId}/invite`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parents", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
    },
  });
}

export function useSendPendingInvites(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.post<BulkSendInvitesResponse>("/v1/parents/invite-pending", null, { params: { tenantId } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parents", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
    },
  });
}

// --- Stop requests (Approvals) ---
// Creation itself (POST /v1/stop-requests) is a parent-facing, invite-code-identified endpoint
// with no admin UI of its own — see backend StopRequestService kdoc. The admin app only ever
// lists and resolves what a parent's (not yet built) app would have submitted.

export function useStopRequests(tenantId: string, status?: StopRequestStatus) {
  return useQuery({
    queryKey: ["stopRequests", tenantId, status ?? "ALL"],
    queryFn: async () =>
      (await api.get<StopRequest[]>("/v1/stop-requests", { params: { tenantId, status } })).data,
  });
}

export function useApproveStopRequest(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, request }: { id: string; request: ApproveStopRequestRequest }) =>
      (await api.post<StopRequest>(`/v1/stop-requests/${id}/approve`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stopRequests", tenantId] });
      // Approving assigns the child a stop, and a NEW_STOP approval creates a real Stop too.
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["stops", tenantId] });
      // An attach-to-route approval (routeId set) changes that route's stop order server-side —
      // without this, a stale cached `routes` list can silently feed RouteModal's "Edit route"
      // screen the pre-attach stop list, and saving it from there would overwrite the attach
      // straight back out. Always invalidate, not just when routeId was set, so a plain approval
      // right before someone edits a route can't leave the same trap either.
      queryClient.invalidateQueries({ queryKey: ["routes", tenantId] });
    },
  });
}

export function useRejectStopRequest(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, request }: { id: string; request: RejectStopRequestRequest }) =>
      (await api.post<StopRequest>(`/v1/stop-requests/${id}/reject`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stopRequests", tenantId] });
    },
  });
}

// Admin-only counter-proposal actions. Accepting/rejecting the suggestion is a parent-facing,
// invite-code-identified pair of endpoints with no admin UI of its own (same shape as stop
// request creation itself) — nothing to wrap here until a parent app exists to call them from.

export function useCounterProposeStopRequest(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, request }: { id: string; request: CounterProposeStopRequestRequest }) =>
      (await api.post<StopRequest>(`/v1/stop-requests/${id}/counter-propose`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stopRequests", tenantId] });
    },
  });
}

export function useRoutePlanPreview(tenantId: string) {
  return useMutation({
    mutationFn: async () =>
      (await api.post<RoutePlanResponse>("/v1/routes/plan", null, { params: { tenantId } })).data,
  });
}

export function useApplyRoutePlan(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: ApplyRoutePlanRequest) => {
      await api.post("/v1/routes/plan/apply", request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["stopRequests", tenantId] });
    },
  });
}

export function useConfirmStop(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stopId, request }: { stopId: string; request: ConfirmStopRequest }) =>
      (await api.post<Stop>(`/v1/stops/${stopId}/confirm`, request)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stops", tenantId] });
      // Moving the pin re-fetches the legs of every route it's on.
      queryClient.invalidateQueries({ queryKey: ["routes", tenantId] });
    },
  });
}

export function useAutoResolvePending(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await api.post<AutoResolveSummary>("/v1/stop-requests/auto-resolve", null, { params: { tenantId } })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stopRequests", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
    },
  });
}

export function useRevertAutoApproval(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<StopRequest>(`/v1/stop-requests/${id}/revert-auto-approval`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stopRequests", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["students", tenantId] });
      // Undoing an approval that created a stop also takes it off its route and deletes it.
      queryClient.invalidateQueries({ queryKey: ["stops", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["routes", tenantId] });
    },
  });
}

export function useWithdrawCounterProposal(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<StopRequest>(`/v1/stop-requests/${id}/withdraw-counter-proposal`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stopRequests", tenantId] });
    },
  });
}

// --- Fleet demand board (operator tenants only) ---

export function useDemandBoard(enabled: boolean) {
  return useQuery({
    queryKey: ["demand"],
    enabled,
    queryFn: async () => (await api.get<DemandBoard>("/v1/demand/schools")).data,
  });
}

export function useDemandSchool(schoolRef: string | null) {
  return useQuery({
    queryKey: ["demand", schoolRef],
    enabled: schoolRef != null,
    queryFn: async () => (await api.get<DemandSchoolDetail>(`/v1/demand/schools/${schoolRef}`)).data,
  });
}

/** Preview stops + van routes drafted from a school's waiting families (saves nothing). */
export function useLaunchPlan(schoolRef: string, stopMergeM: number) {
  return useQuery({
    queryKey: ["launch-plan", schoolRef, stopMergeM],
    queryFn: async () => (await api.post<LaunchPlan>(`/v1/demand/schools/${schoolRef}/plan`, { stopMergeM })).data,
  });
}

/** Launch: creates the school's stops + routes and sends every family an offer. */
export function useLaunchSchool(schoolRef: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: LaunchRequest) =>
      (await api.post<LaunchResult>(`/v1/demand/schools/${schoolRef}/launch`, request)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["demand"] });
      void queryClient.invalidateQueries({ queryKey: ["routes"] });
      void queryClient.invalidateQueries({ queryKey: ["stops"] });
    },
  });
}
