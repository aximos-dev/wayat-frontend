import { useState } from "react";
import { isAxiosError } from "axios";
import { useCreateDriver, useUpdateDriver } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, Driver } from "../lib/types";
import { Modal } from "./Modal";
import { InfoIcon, Tooltip } from "./Tooltip";

export function DriverModal({
  tenantId,
  driver,
  onClose,
}: {
  tenantId: string;
  /** Omit to create a new driver; pass an existing one to edit it. */
  driver?: Driver;
  onClose: () => void;
}) {
  const isEditing = driver != null;
  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver(tenantId);
  const { showSuccess, showError } = useToast();

  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateDriver.mutateAsync({ driverId: driver.id, request: { name, phone } });
        showSuccess("Driver updated");
      } else {
        await createDriver.mutateAsync({ tenantId, name, phone });
        showSuccess("Driver added");
      }
      onClose();
    } catch (err) {
      // Surfaces the backend's own message — e.g. DRIVER_PHONE_ALREADY_EXISTS — rather than a
      // generic failure.
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  const isSaving = createDriver.isPending || updateDriver.isPending;

  return (
    <Modal>
      <h2 className="text-lg font-semibold text-text-primary">
        {isEditing ? "Edit driver" : "Add a driver"}
      </h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ravi Kumar"
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Phone</span>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +919900011122"
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            This is also the driver's login.
            <Tooltip
              trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
              content="It must be unique across the whole app."
            />
          </span>
        </label>

        {isEditing && (
          <div className="rounded-md bg-bg-base px-3 py-2.5 text-sm">
            <span className="text-xs uppercase tracking-wide text-text-muted">Vehicle assignment</span>
            <div className="mt-1 flex flex-col gap-0.5 text-text-primary">
              {driver.morningVehicleId && <p>Morning: driving {driver.morningVehicleRegNo}</p>}
              {driver.morningCoDriverOfVehicleId && (
                <p>Morning: co-driving {driver.morningCoDriverOfVehicleRegNo}</p>
              )}
              {driver.eveningVehicleId && <p>Evening: driving {driver.eveningVehicleRegNo}</p>}
              {driver.eveningCoDriverOfVehicleId && (
                <p>Evening: co-driving {driver.eveningCoDriverOfVehicleRegNo}</p>
              )}
              {!driver.morningVehicleId &&
                !driver.morningCoDriverOfVehicleId &&
                !driver.eveningVehicleId &&
                !driver.eveningCoDriverOfVehicleId && (
                  <p className="text-text-muted">Not currently assigned to a vehicle</p>
                )}
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Change this from the Vehicles tab, not here.
            </p>
          </div>
        )}

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
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Save driver"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
