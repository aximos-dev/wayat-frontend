import { useState } from "react";
import { isAxiosError } from "axios";
import { useCreateVehicle, useUpdateVehicle, useVehicleTypes } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, Driver, Vehicle } from "../lib/types";
import { Modal } from "./Modal";
import { InfoIcon, Tooltip } from "./Tooltip";

const NONE = "";
type Leg = "morning" | "evening";

/** True if `driver` already holds a role (driver or co-driver) IN THIS LEG on some vehicle other
 *  than `vehicleId` — used to drop them from the picker entirely rather than letting them be
 *  picked and silently moved. The other leg is deliberately not checked: a driver already
 *  assigned there isn't a conflict, so it has no bearing on this leg's options. */
function isAssignedElsewhereInLeg(driver: Driver, leg: Leg, vehicleId: string | undefined): boolean {
  const [asDriverOf, asCoDriverOf] =
    leg === "morning"
      ? [driver.morningVehicleId, driver.morningCoDriverOfVehicleId]
      : [driver.eveningVehicleId, driver.eveningCoDriverOfVehicleId];
  return (asDriverOf != null && asDriverOf !== vehicleId) || (asCoDriverOf != null && asCoDriverOf !== vehicleId);
}

function LegSection({
  leg,
  label,
  vehicleId,
  drivers,
  driverId,
  coDriverId,
  onDriverChange,
  onCoDriverChange,
}: {
  leg: Leg;
  label: string;
  vehicleId: string | undefined;
  drivers: Driver[];
  driverId: string;
  coDriverId: string;
  onDriverChange: (id: string) => void;
  onCoDriverChange: (id: string) => void;
}) {
  return (
    <div className="rounded-md bg-bg-base p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">{label}</span>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Driver</span>
          <select
            value={driverId}
            onChange={(e) => onDriverChange(e.target.value)}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-text-primary outline-none focus:border-accent"
          >
            <option value={NONE}>— None —</option>
            {drivers
              .filter((d) => d.id !== coDriverId && !isAssignedElsewhereInLeg(d, leg, vehicleId))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Co-driver</span>
          <select
            value={coDriverId}
            onChange={(e) => onCoDriverChange(e.target.value)}
            className="rounded-md border border-border bg-bg-surface px-3 py-2 text-text-primary outline-none focus:border-accent"
          >
            <option value={NONE}>— None —</option>
            {drivers
              .filter((d) => d.id !== driverId && !isAssignedElsewhereInLeg(d, leg, vehicleId))
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export function VehicleModal({
  tenantId,
  vehicle,
  drivers,
  onClose,
  onManageTypes,
}: {
  tenantId: string;
  /** Omit to create a new vehicle; pass an existing one to edit it. */
  vehicle?: Vehicle;
  drivers: Driver[];
  onClose: () => void;
  onManageTypes: () => void;
}) {
  const isEditing = vehicle != null;
  const vehicleTypes = useVehicleTypes(tenantId);
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle(tenantId);
  const { showSuccess, showError } = useToast();

  const [regNo, setRegNo] = useState(vehicle?.regNo ?? "");
  const [vehicleTypeId, setVehicleTypeId] = useState(vehicle?.vehicleTypeId ?? "");
  const [seats, setSeats] = useState(vehicle ? String(vehicle.seats) : "");
  const [morningDriverId, setMorningDriverId] = useState(vehicle?.morningDriverId ?? NONE);
  const [morningCoDriverId, setMorningCoDriverId] = useState(vehicle?.morningCoDriverId ?? NONE);
  const [eveningDriverId, setEveningDriverId] = useState(vehicle?.eveningDriverId ?? NONE);
  const [eveningCoDriverId, setEveningCoDriverId] = useState(vehicle?.eveningCoDriverId ?? NONE);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const request = {
      regNo,
      vehicleTypeId,
      seats: Number(seats),
      morningDriverId: morningDriverId || null,
      morningCoDriverId: morningCoDriverId || null,
      eveningDriverId: eveningDriverId || null,
      eveningCoDriverId: eveningCoDriverId || null,
    };
    try {
      if (isEditing) {
        await updateVehicle.mutateAsync({ vehicleId: vehicle.id, request });
        showSuccess("Vehicle updated");
      } else {
        await createVehicle.mutateAsync({ tenantId, ...request });
        showSuccess("Vehicle added");
      }
      onClose();
    } catch (err) {
      // Surfaces the backend's own message — e.g. DRIVER_DOUBLE_ASSIGNED's explanation, or a
      // duplicate reg no — rather than a generic failure.
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  const isSaving = createVehicle.isPending || updateVehicle.isPending;
  const noTypes = vehicleTypes.data?.length === 0;

  return (
    <Modal maxWidthClassName="max-w-xl">
      <h2 className="text-lg font-semibold text-text-primary">
        {isEditing ? "Edit vehicle" : "Add a vehicle"}
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Registration number</span>
            <input
              required
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              placeholder="e.g. KA 05 AB 1234"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Seating capacity</span>
            <input
              required
              type="number"
              min={1}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              placeholder="e.g. 12"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-text-muted">Type</span>
            <button
              type="button"
              onClick={onManageTypes}
              className="text-xs text-text-muted underline-offset-2 hover:text-accent-muted hover:underline"
            >
              Manage types
            </button>
          </div>
          <select
            required
            value={vehicleTypeId}
            onChange={(e) => setVehicleTypeId(e.target.value)}
            disabled={noTypes}
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent disabled:text-text-muted"
          >
            <option value="" disabled>
              {noTypes ? "No vehicle types yet" : "— Choose a type —"}
            </option>
            {vehicleTypes.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            Morning and evening are assigned independently.
            <Tooltip
              trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
              content="The same driver can be the morning driver of one vehicle and the evening driver of a different one at once. A driver already assigned to another vehicle in a leg won't show up there for this one — unassign them from that vehicle first to move them."
            />
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <LegSection
              leg="morning"
              label="Morning leg"
              vehicleId={vehicle?.id}
              drivers={drivers}
              driverId={morningDriverId}
              coDriverId={morningCoDriverId}
              onDriverChange={setMorningDriverId}
              onCoDriverChange={setMorningCoDriverId}
            />
            <LegSection
              leg="evening"
              label="Evening leg"
              vehicleId={vehicle?.id}
              drivers={drivers}
              driverId={eveningDriverId}
              coDriverId={eveningCoDriverId}
              onDriverChange={setEveningDriverId}
              onCoDriverChange={setEveningCoDriverId}
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Save vehicle"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
