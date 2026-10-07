import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "../lib/AuthContext";
import { useDeleteDriver, useDeleteVehicle, useDrivers, useRoutes, useVehicles } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import { BulkImportDriversModal } from "../components/BulkImportDriversModal";
import { BulkImportVehiclesModal } from "../components/BulkImportVehiclesModal";
import { DriverModal } from "../components/DriverModal";
import { Tooltip } from "../components/Tooltip";
import { VehicleModal } from "../components/VehicleModal";
import { VehicleTypeModal } from "../components/VehicleTypeModal";
import type { ApiError, Driver, Vehicle } from "../lib/types";

type Tab = "drivers" | "vehicles";

/** Compact "driver, co-driver (co)" summary for one leg's Vehicles-tab cell — "—" when neither
 *  is assigned. */
function legCellText(driverName: string | null, coDriverName: string | null): string {
  const parts = [];
  if (driverName) parts.push(driverName);
  if (coDriverName) parts.push(`${coDriverName} (co)`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function DriversVehiclesPage() {
  const { principal } = useAuth();
  const tenantId = principal!.tenantId;
  const [tab, setTab] = useState<Tab>("drivers");

  const [addDriverOpen, setAddDriverOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [bulkImportDriversOpen, setBulkImportDriversOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [bulkImportVehiclesOpen, setBulkImportVehiclesOpen] = useState(false);

  const { showSuccess, showError } = useToast();

  const drivers = useDrivers(tenantId);
  const vehicles = useVehicles(tenantId);
  const routes = useRoutes(tenantId);
  const deleteDriver = useDeleteDriver(tenantId);
  const deleteVehicle = useDeleteVehicle(tenantId);

  const driverCount = drivers.data?.length ?? 0;
  const vehicleCount = vehicles.data?.length ?? 0;

  // Lets Delete be disabled with an explanation for a vehicle on a route, instead of the admin
  // discovering VEHICLE_IN_USE only after clicking — same pattern as Stops' "used by N routes"
  // guard. A vehicle could still be blocked by ride history alone (not visible client-side, no
  // ride list UI exists yet); that case still surfaces via the backend's own error message below.
  const vehicleIdsOnRoutes = useMemo(
    () => new Set((routes.data ?? []).map((r) => r.vehicleId)),
    [routes.data],
  );

  function handleApiError(err: unknown) {
    if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
      showError(err.response.data.message);
    } else {
      showError("Something went wrong.");
    }
  }

  function handleDeleteDriver(driverId: string) {
    deleteDriver.mutate(driverId, {
      onSuccess: () => showSuccess("Driver deleted"),
      onError: handleApiError,
    });
  }

  function handleDeleteVehicle(vehicleId: string) {
    deleteVehicle.mutate(vehicleId, {
      onSuccess: () => showSuccess("Vehicle deleted"),
      onError: handleApiError,
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Drivers & Vehicles</h1>
          <p className="mt-1 text-sm text-text-muted">
            {driverCount} driver{driverCount === 1 ? "" : "s"} · {vehicleCount} vehicle{vehicleCount === 1 ? "" : "s"}
          </p>
        </div>
        {tab === "drivers" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBulkImportDriversOpen(true)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary"
            >
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setAddDriverOpen(true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
            >
              + Add driver
            </button>
          </div>
        )}
        {tab === "vehicles" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setManageTypesOpen(true)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary"
            >
              Manage types
            </button>
            <button
              type="button"
              onClick={() => setBulkImportVehiclesOpen(true)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary"
            >
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setAddVehicleOpen(true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
            >
              + Add vehicle
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {(["drivers", "vehicles"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "rounded-md px-3 py-1.5 text-sm capitalize " +
              (tab === t ? "bg-accent-bg text-accent-muted" : "text-text-muted hover:text-text-primary")
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {tab === "drivers" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Vehicle</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {drivers.isLoading && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={4}>Loading…</td></tr>
              )}
              {drivers.data?.length === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={4}>No drivers yet.</td></tr>
              )}
              {drivers.data?.map((driver) => {
                const isAssigned =
                  driver.morningVehicleId != null ||
                  driver.morningCoDriverOfVehicleId != null ||
                  driver.eveningVehicleId != null ||
                  driver.eveningCoDriverOfVehicleId != null;
                return (
                  <tr key={driver.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                    <td className="px-5 py-3 font-medium text-text-primary">{driver.name}</td>
                    <td className="px-5 py-3 text-text-muted">{driver.phone}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {!isAssigned && "—"}
                      {(driver.morningVehicleId || driver.morningCoDriverOfVehicleId) && (
                        <div>
                          Morning: {driver.morningVehicleRegNo ?? driver.morningCoDriverOfVehicleRegNo}{" "}
                          <span className="text-xs">
                            ({driver.morningVehicleId ? "driver" : "co-driver"})
                          </span>
                        </div>
                      )}
                      {(driver.eveningVehicleId || driver.eveningCoDriverOfVehicleId) && (
                        <div>
                          Evening: {driver.eveningVehicleRegNo ?? driver.eveningCoDriverOfVehicleRegNo}{" "}
                          <span className="text-xs">
                            ({driver.eveningVehicleId ? "driver" : "co-driver"})
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingDriver(driver)}
                          className="text-xs text-text-muted hover:text-text-primary"
                        >
                          Edit
                        </button>
                        {isAssigned ? (
                          <Tooltip
                            align="right"
                            trigger={
                              <span className="cursor-not-allowed text-xs text-text-muted opacity-40">
                                Delete
                              </span>
                            }
                            content="Currently assigned to a vehicle. Unassign them from the Vehicles tab first."
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteDriver(driver.id)}
                            className="text-xs text-text-muted hover:text-danger"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === "vehicles" && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
                <th className="px-5 py-3 font-medium">Reg no</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Seats</th>
                <th className="px-5 py-3 font-medium">Morning</th>
                <th className="px-5 py-3 font-medium">Evening</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.isLoading && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>Loading…</td></tr>
              )}
              {vehicles.data?.length === 0 && (
                <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>No vehicles yet.</td></tr>
              )}
              {vehicles.data?.map((vehicle) => {
                const isOnRoute = vehicleIdsOnRoutes.has(vehicle.id);
                return (
                  <tr key={vehicle.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                    <td className="px-5 py-3 font-medium text-text-primary">{vehicle.regNo}</td>
                    <td className="px-5 py-3 text-text-muted">{vehicle.vehicleTypeName}</td>
                    <td className="px-5 py-3 text-text-muted">{vehicle.seats}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {legCellText(vehicle.morningDriverName, vehicle.morningCoDriverName)}
                    </td>
                    <td className="px-5 py-3 text-text-muted">
                      {legCellText(vehicle.eveningDriverName, vehicle.eveningCoDriverName)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingVehicle(vehicle)}
                          className="text-xs text-text-muted hover:text-text-primary"
                        >
                          Edit
                        </button>
                        {isOnRoute ? (
                          <Tooltip
                            align="right"
                            trigger={
                              <span className="cursor-not-allowed text-xs text-text-muted opacity-40">
                                Delete
                              </span>
                            }
                            content="Used by a route. Remove it from that route first."
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                            className="text-xs text-text-muted hover:text-danger"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {addDriverOpen && (
        <DriverModal tenantId={tenantId} onClose={() => setAddDriverOpen(false)} />
      )}
      {editingDriver && (
        <DriverModal tenantId={tenantId} driver={editingDriver} onClose={() => setEditingDriver(null)} />
      )}
      {bulkImportDriversOpen && (
        <BulkImportDriversModal tenantId={tenantId} onClose={() => setBulkImportDriversOpen(false)} />
      )}

      {addVehicleOpen && (
        <VehicleModal
          tenantId={tenantId}
          drivers={drivers.data ?? []}
          onClose={() => setAddVehicleOpen(false)}
          onManageTypes={() => setManageTypesOpen(true)}
        />
      )}
      {editingVehicle && (
        <VehicleModal
          tenantId={tenantId}
          vehicle={editingVehicle}
          drivers={drivers.data ?? []}
          onClose={() => setEditingVehicle(null)}
          onManageTypes={() => setManageTypesOpen(true)}
        />
      )}
      {manageTypesOpen && (
        <VehicleTypeModal tenantId={tenantId} onClose={() => setManageTypesOpen(false)} />
      )}
      {bulkImportVehiclesOpen && (
        <BulkImportVehiclesModal tenantId={tenantId} onClose={() => setBulkImportVehiclesOpen(false)} />
      )}
    </div>
  );
}
