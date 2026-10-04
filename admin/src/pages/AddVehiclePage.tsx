import { useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useCreateVehicle } from "../lib/queries";
import type { ApiError } from "../lib/types";

export function AddVehiclePage() {
  const { principal } = useAuth();
  const navigate = useNavigate();
  const createVehicle = useCreateVehicle();

  const [regNo, setRegNo] = useState("");
  const [type, setType] = useState("Van");
  const [seats, setSeats] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createVehicle.mutateAsync({
        tenantId: principal!.tenantId,
        regNo,
        type,
        seats: Number(seats),
      });
      navigate("/routes-stops");
    } catch (err) {
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Something went wrong.");
      }
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-text-primary">Add a vehicle</h1>
      <p className="mt-1 text-sm text-text-muted">New vehicle for the fleet</p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 max-w-xl rounded-xl border border-border bg-bg-surface p-6"
      >
        <h2 className="text-base font-semibold text-text-primary">Vehicle details</h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
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
            <span className="text-xs uppercase tracking-wide text-text-muted">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            >
              <option>Van</option>
              <option>Bus</option>
              <option>Minibus</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Seating capacity</span>
            <input
              required
              type="number"
              min={1}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              placeholder="e.g. 24"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>

        <p className="mt-5 rounded-md bg-warning-bg px-3 py-2 text-xs text-warning">
          Two fields from the design aren't wired yet — "assign driver" (today a driver is only
          attached to a specific ride, not permanently to a vehicle) and document expiry tracking
          (insurance/fitness certificate — no field exists for this on the backend yet). Both are
          real gaps, not hidden here.
        </p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/routes-stops")}
            className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createVehicle.isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
          >
            {createVehicle.isPending ? "Saving…" : "Save vehicle"}
          </button>
        </div>
      </form>
    </div>
  );
}
