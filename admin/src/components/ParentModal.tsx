import { useState } from "react";
import { isAxiosError } from "axios";
import { useCreateParent, useUpdateParent } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, Parent } from "../lib/types";
import { Modal } from "./Modal";
import { PhoneInput } from "./PhoneInput";

export function ParentModal({
  tenantId,
  parent,
  onClose,
}: {
  tenantId: string;
  /** Omit to add a new parent; pass an existing one to edit them, including their phone — same
   *  capability as Driver's edit form. */
  parent?: Parent;
  onClose: () => void;
}) {
  const isEditing = parent != null;
  const createParent = useCreateParent();
  const updateParent = useUpdateParent(tenantId);
  const { showSuccess, showError } = useToast();

  const [firstName, setFirstName] = useState(parent?.firstName ?? "");
  const [lastName, setLastName] = useState(parent?.lastName ?? "");
  const [phone, setPhone] = useState(parent?.phone ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateParent.mutateAsync({ parentId: parent.id, request: { firstName, lastName: lastName || null, phone } });
        showSuccess("Parent updated");
      } else {
        await createParent.mutateAsync({ tenantId, firstName, lastName: lastName || null, phone });
        showSuccess("Parent added");
      }
      onClose();
    } catch (err) {
      // Surfaces the backend's own message — e.g. a duplicate phone — rather than a generic
      // failure.
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  const isSaving = createParent.isPending || updateParent.isPending;

  return (
    <Modal>
      <h2 className="text-lg font-semibold text-text-primary">{isEditing ? "Edit parent" : "Add a parent"}</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">First name</span>
            <input
              required
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Kavita"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Last name</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Shankar (optional)"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Phone</span>
          <PhoneInput required value={phone} onChange={setPhone} />
        </label>

        <div className="mt-1 flex justify-end gap-3 border-t border-border pt-4">
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
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Save parent"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
