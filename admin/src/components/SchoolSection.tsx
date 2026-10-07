import { useState } from "react";
import { isAxiosError } from "axios";
import { useCreateSchool, useSchool, useUpdateSchool } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError } from "../lib/types";
import { StopLocationPicker } from "./StopLocationPicker";
import { Tooltip } from "./Tooltip";

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.25" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 17 17 7M17 7H9M17 7v8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A small (i) button that reveals explanatory copy on hover/focus instead of it sitting
 *  permanently in the layout — keeps the card body to just the thing you came here to do. */
function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip
      trigger={
        <button
          type="button"
          aria-label="More info"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-text-muted text-[10px] font-semibold leading-none text-text-muted transition-colors hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent focus-visible:outline-none"
        >
          i
        </button>
      }
      content={text}
    />
  );
}

export function SchoolSection({ tenantId }: { tenantId: string }) {
  const school = useSchool(tenantId);
  const createSchool = useCreateSchool();
  const updateSchool = useUpdateSchool();
  const { showSuccess, showError } = useToast();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  function startCreate() {
    setName("");
    setLat(null);
    setLng(null);
    setEditing(true);
  }

  function startEdit() {
    if (school.data) {
      setName(school.data.name);
      setLat(school.data.lat);
      setLng(school.data.lng);
    }
    setEditing(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lat === null || lng === null) {
      showError("Pick a location on the map first.");
      return;
    }
    try {
      if (school.data) {
        await updateSchool.mutateAsync({ schoolId: school.data.id, request: { name, lat, lng } });
        showSuccess("Destination school updated");
      } else {
        await createSchool.mutateAsync({ tenantId, name, lat, lng });
        showSuccess("Destination school added");
      }
      setEditing(false);
    } catch (err) {
      // Surfaces the backend's own message verbatim, same convention as every other form in
      // this app (e.g. SchoolAlreadyExistsException, VALIDATION_FAILED).
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  const isSaving = createSchool.isPending || updateSchool.isPending;

  return (
    <section className="max-w-2xl rounded-xl border border-border bg-bg-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold text-text-primary">Destination school</h2>
          <InfoTooltip
            text={
              "Every route on this tenant ends here in the morning, and will start here on the " +
              "evening leg — one shared location for every bus. A route can't be created until " +
              "this is set."
            }
          />
        </div>
        {school.data && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-text-primary"
          >
            Edit
          </button>
        )}
      </div>

      {school.isLoading && (
        <p className="mt-5 text-sm text-text-muted">Loading…</p>
      )}

      {!school.isLoading && !school.data && !editing && (
        <button
          type="button"
          onClick={startCreate}
          className="mt-5 flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-8 text-center transition-colors hover:border-accent"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-bg text-accent">
            <PinIcon className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-text-primary">Set up destination school</span>
          <span className="text-xs text-text-muted">No school is configured for this tenant yet</span>
        </button>
      )}

      {!editing && school.data && (
        <div className="mt-5 flex items-center gap-3 rounded-lg bg-bg-base px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-bg text-accent">
            <PinIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{school.data.name}</p>
            <p className="text-xs text-text-muted">
              {school.data.lat.toFixed(6)}, {school.data.lng.toFixed(6)}
            </p>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${school.data.lat},${school.data.lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent-muted"
          >
            View on map
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ryan International Campus"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Location</span>
            <StopLocationPicker
              lat={lat}
              lng={lng}
              onChange={(newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
              }}
            />
          </label>
          {school.data && (
            <p className="rounded-md bg-warning-bg px-3 py-2 text-xs leading-relaxed text-warning">
              Moving this won't recalculate distance on existing routes — only routes you create
              or edit after saving will use the new location for their final leg.
            </p>
          )}
          <div className="mt-1 flex justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
