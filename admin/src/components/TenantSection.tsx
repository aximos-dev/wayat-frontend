import { useState } from "react";
import { isAxiosError } from "axios";
import { useRegenerateTenantInviteCode, useTenant, useUpdateTenant } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError } from "../lib/types";
import { InfoIcon, Tooltip } from "./Tooltip";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="9" y="9" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 15H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 4h8A1.5 1.5 0 0 1 14.5 5.5V6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function TenantSection({ tenantId }: { tenantId: string }) {
  const tenant = useTenant(tenantId);
  const updateTenant = useUpdateTenant(tenantId);
  const regenerateCode = useRegenerateTenantInviteCode(tenantId);
  const { showSuccess, showError } = useToast();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  function startEdit() {
    setName(tenant.data?.name ?? "");
    setEditing(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateTenant.mutateAsync({ name });
      showSuccess("Organization name updated");
      setEditing(false);
    } catch (err) {
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  async function handleCopyCode() {
    if (!tenant.data) return;
    try {
      await navigator.clipboard.writeText(tenant.data.inviteCode);
      showSuccess("Invite code copied");
    } catch {
      showError("Couldn't copy — select and copy it manually.");
    }
  }

  async function handleRegenerateCode() {
    try {
      await regenerateCode.mutateAsync();
      showSuccess("Invite code regenerated — the old one no longer works");
    } catch (err) {
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  return (
    <section className="max-w-2xl rounded-xl border border-border bg-bg-surface p-6">
      <h2 className="text-base font-semibold text-text-primary">Organization</h2>

      {tenant.isLoading && <p className="mt-5 text-sm text-text-muted">Loading…</p>}

      {!tenant.isLoading && tenant.data && (
        <div className="mt-5 flex flex-col gap-5">
          <div>
            <span className="text-xs uppercase tracking-wide text-text-muted">Name</span>
            {editing ? (
              <form onSubmit={handleSubmit} className="mt-1.5 flex items-center gap-3">
                <input
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={updateTenant.isPending}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-md border border-border px-3 py-2 text-sm text-text-primary"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-sm text-text-primary">{tenant.data.name}</p>
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <div>
            <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-muted">
              Parent invite code
              <Tooltip
                trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
                content="A fallback, tenant-wide code — give it to a parent who never got (or lost) their own personal WhatsApp invite from the Students page. It only tells the app which school they belong to, not which child, so you'll still need to link them manually in that case."
              />
            </span>
            <div className="mt-1.5 flex items-center gap-3">
              <code className="rounded-md bg-bg-base px-3 py-2 text-sm tracking-wide text-text-primary">
                {tenant.data.inviteCode}
              </code>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
              >
                <CopyIcon className="h-3.5 w-3.5" />
                Copy
              </button>
              <button
                type="button"
                onClick={() => void handleRegenerateCode()}
                disabled={regenerateCode.isPending}
                className="text-xs text-text-muted hover:text-danger disabled:opacity-40"
              >
                {regenerateCode.isPending ? "Regenerating…" : "Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
