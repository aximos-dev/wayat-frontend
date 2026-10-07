import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  useCreateVehicleType,
  useDeleteVehicleType,
  useUpdateVehicleType,
  useVehicleTypes,
  useVehicles,
} from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, VehicleType } from "../lib/types";
import { Modal } from "./Modal";
import { InfoIcon, Tooltip } from "./Tooltip";

export function VehicleTypeModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const vehicleTypes = useVehicleTypes(tenantId);
  const vehicles = useVehicles(tenantId);
  const createVehicleType = useCreateVehicleType();
  const updateVehicleType = useUpdateVehicleType(tenantId);
  const deleteVehicleType = useDeleteVehicleType(tenantId);
  const { showSuccess, showError } = useToast();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Lets Delete be disabled with an explanation instead of the admin discovering VEHICLE_TYPE_IN_USE
  // only after clicking — same pattern as the Stops tab's "used by N routes" guard.
  const usageCountByTypeId = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vehicles.data ?? []) {
      map.set(v.vehicleTypeId, (map.get(v.vehicleTypeId) ?? 0) + 1);
    }
    return map;
  }, [vehicles.data]);

  function handleApiError(err: unknown) {
    if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
      showError(err.response.data.message);
    } else {
      showError("Something went wrong.");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      await createVehicleType.mutateAsync({ tenantId, name });
      setNewName("");
      showSuccess("Vehicle type added");
    } catch (err) {
      handleApiError(err);
    }
  }

  function startEdit(type: VehicleType) {
    setEditingId(type.id);
    setEditingName(type.name);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    const name = editingName.trim();
    if (!editingId || !name) return;
    try {
      await updateVehicleType.mutateAsync({ vehicleTypeId: editingId, request: { name } });
      setEditingId(null);
      showSuccess("Vehicle type renamed");
    } catch (err) {
      handleApiError(err);
    }
  }

  function handleDelete(type: VehicleType) {
    deleteVehicleType.mutate(type.id, {
      onSuccess: () => showSuccess("Vehicle type deleted"),
      onError: handleApiError,
    });
  }

  return (
    <Modal>
      <h2 className="text-lg font-semibold text-text-primary">Vehicle types</h2>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
        Shared across your fleet.
        <Tooltip
          trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
          content="e.g. Van, Mini Van, Bus. Used when adding or editing a vehicle."
        />
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {vehicleTypes.isLoading && <p className="px-1 text-sm text-text-muted">Loading…</p>}
        {vehicleTypes.data?.length === 0 && (
          <p className="px-1 text-sm text-text-muted">No vehicle types yet. Add one below.</p>
        )}
        {vehicleTypes.data?.map((type) => {
          const usageCount = usageCountByTypeId.get(type.id) ?? 0;
          const isEditingThis = editingId === type.id;
          return (
            <div
              key={type.id}
              className="flex items-center gap-3 rounded-md bg-bg-base px-3 py-2.5 transition-colors"
            >
              {isEditingThis ? (
                <form onSubmit={handleRename} className="flex flex-1 items-center gap-2">
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 rounded-md border border-border bg-bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
                  />
                  <button
                    type="submit"
                    disabled={!editingName.trim() || updateVehicleType.isPending}
                    className="text-xs font-medium text-accent-muted hover:text-accent disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm text-text-primary">{type.name}</span>
                  {usageCount > 0 && (
                    <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs text-accent-muted">
                      {usageCount} vehicle{usageCount === 1 ? "" : "s"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => startEdit(type)}
                    className="text-xs text-text-muted hover:text-text-primary"
                  >
                    Edit
                  </button>
                  {usageCount > 0 ? (
                    <Tooltip
                      align="right"
                      trigger={
                        <span className="cursor-not-allowed text-xs text-text-muted opacity-40">Delete</span>
                      }
                      content={`Used by ${usageCount} vehicle${usageCount === 1 ? "" : "s"}. Change their type first.`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDelete(type)}
                      className="text-xs text-text-muted hover:text-danger"
                    >
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}

        <form
          onSubmit={handleAdd}
          className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5"
        >
          <span className="text-accent-muted">+</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New vehicle type, e.g. Mini Van"
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="submit"
            disabled={!newName.trim() || createVehicleType.isPending}
            className="text-xs font-medium text-accent-muted hover:text-accent disabled:opacity-40"
          >
            Add
          </button>
        </form>
      </div>

      <div className="mt-5 flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
