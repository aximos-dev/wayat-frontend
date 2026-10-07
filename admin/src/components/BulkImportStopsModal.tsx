import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { isAxiosError } from "axios";
import { useBulkCreateStops } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError } from "../lib/types";
import { Modal } from "./Modal";
import { Tooltip } from "./Tooltip";

interface ParsedRow {
  rowIndex: number;
  name: string;
  lat: number;
  lng: number;
  geofenceM?: number;
  parseError: string | null;
}

type SubmitOutcome = { status: "created" | "failed"; message?: string };

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  // A first row is treated as a header (and skipped) when its 2nd/3rd columns don't parse as
  // numbers — real data always has numeric lat/lng there.
  let dataLines = lines;
  const firstFields = splitCsvLine(lines[0]);
  const looksLikeHeader =
    firstFields.length >= 3 && (!Number.isFinite(Number(firstFields[1])) || !Number.isFinite(Number(firstFields[2])));
  if (looksLikeHeader) {
    dataLines = lines.slice(1);
  }

  const rows: ParsedRow[] = dataLines.map((line, rowIndex) => {
    const fields = splitCsvLine(line);
    const name = (fields[0] ?? "").trim();
    const lat = Number(fields[1]);
    const lng = Number(fields[2]);
    const geofenceRaw = fields[3]?.trim();
    const geofenceM = geofenceRaw ? Number(geofenceRaw) : undefined;

    let parseError: string | null = null;
    if (fields.length < 3) {
      parseError = "Expected at least name, lat, lng";
    } else if (!name) {
      parseError = "Name is required";
    } else if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      parseError = "Lat must be a number between -90 and 90";
    } else if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      parseError = "Lng must be a number between -180 and 180";
    } else if (geofenceRaw !== undefined && geofenceRaw !== "" && (!Number.isFinite(geofenceM) || (geofenceM ?? 0) <= 0)) {
      parseError = "Geofence must be a positive number";
    }

    return { rowIndex, name, lat, lng, geofenceM, parseError };
  });

  // A second pass so duplicate names *within this paste* are flagged client-side too, not just
  // ones that collide with stops already in the database (which only the backend can catch).
  const firstSeenAt = new Map<string, number>();
  for (const row of rows) {
    if (row.parseError) continue;
    const key = row.name.toLowerCase();
    const earlierRow = firstSeenAt.get(key);
    if (earlierRow !== undefined) {
      row.parseError = `Duplicate name in this list (same as row ${earlierRow + 1})`;
    } else {
      firstSeenAt.set(key, row.rowIndex);
    }
  }

  return rows;
}

function StatusBadge({ row, outcome }: { row: ParsedRow; outcome?: SubmitOutcome }) {
  if (row.parseError) {
    return (
      <Tooltip
        align="right"
        trigger={
          <span className="cursor-default rounded-full bg-danger-bg px-2 py-0.5 text-xs text-danger">
            Invalid
          </span>
        }
        content={row.parseError}
      />
    );
  }
  if (outcome?.status === "created") {
    return <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs text-success">Added</span>;
  }
  if (outcome?.status === "failed") {
    return (
      <Tooltip
        align="right"
        trigger={
          <span className="cursor-default rounded-full bg-danger-bg px-2 py-0.5 text-xs text-danger">
            Failed
          </span>
        }
        content={outcome.message}
      />
    );
  }
  return <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xs text-neutral">Ready</span>;
}

export function BulkImportStopsModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const bulkCreate = useBulkCreateStops(tenantId);
  const { showSuccess, showError } = useToast();
  const [csvText, setCsvText] = useState("");
  const [submitOutcome, setSubmitOutcome] = useState<Map<number, SubmitOutcome>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => parseCsv(csvText), [csvText]);
  const validRows = useMemo(() => rows.filter((r) => r.parseError === null), [rows]);

  function handleTextChange(value: string) {
    setCsvText(value);
    setSubmitOutcome(new Map());
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleTextChange(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImport() {
    if (validRows.length === 0) return;
    try {
      const result = await bulkCreate.mutateAsync({
        tenantId,
        stops: validRows.map((r) => ({ name: r.name, lat: r.lat, lng: r.lng, geofenceM: r.geofenceM })),
      });

      const outcome = new Map<number, SubmitOutcome>();
      validRows.forEach((r) => outcome.set(r.rowIndex, { status: "created" }));
      result.failed.forEach((f) => {
        const row = validRows[f.index];
        if (row) outcome.set(row.rowIndex, { status: "failed", message: f.message });
      });
      setSubmitOutcome(outcome);

      if (result.created.length > 0) {
        showSuccess(`${result.created.length} stop${result.created.length === 1 ? "" : "s"} added`);
      }
      if (result.failed.length > 0) {
        showError(
          `${result.failed.length} row${result.failed.length === 1 ? "" : "s"} couldn't be added — see details below`,
        );
      } else {
        onClose();
      }
    } catch (err) {
      if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
        showError(err.response.data.message);
      } else {
        showError("Something went wrong.");
      }
    }
  }

  return (
    <Modal maxWidthClassName="max-w-3xl">
      <h2 className="text-lg font-semibold text-text-primary">Import stops from CSV</h2>
      <p className="mt-1 text-sm text-text-muted">
        Columns: name, lat, lng, geofence (optional, meters — defaults to 75). A header row is
        detected automatically.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-text-muted">Paste or upload</span>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium text-accent-muted hover:underline"
            >
              Upload a .csv file
            </button>
          </div>
        </div>
        <textarea
          value={csvText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={"name,lat,lng,geofence\nRagigudda Signal,12.9352,77.5623,75\nKoramangala Gate,12.9352,77.6245"}
          rows={6}
          className="w-full resize-y rounded-md border border-border bg-bg-base px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent"
        />
      </div>

      {rows.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-text-muted">
            {validRows.length} of {rows.length} row{rows.length === 1 ? "" : "s"} ready to import.
          </p>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-bg-surface">
                <tr className="text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Lat</th>
                  <th className="px-3 py-2 font-medium">Lng</th>
                  <th className="px-3 py-2 font-medium">Geofence</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowIndex} className="border-t border-border">
                    <td className="px-3 py-1.5 text-text-muted">{row.rowIndex + 1}</td>
                    <td className="px-3 py-1.5 text-text-primary">{row.name || "—"}</td>
                    <td className="px-3 py-1.5 text-text-muted">
                      {Number.isFinite(row.lat) ? row.lat.toFixed(4) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-text-muted">
                      {Number.isFinite(row.lng) ? row.lng.toFixed(4) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-text-muted">
                      {row.geofenceM ?? 75}m
                    </td>
                    <td className="px-3 py-1.5">
                      <StatusBadge row={row} outcome={submitOutcome.get(row.rowIndex)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-2 text-sm text-text-primary"
        >
          {submitOutcome.size > 0 ? "Close" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={validRows.length === 0 || bulkCreate.isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
        >
          {bulkCreate.isPending
            ? "Importing…"
            : `Import ${validRows.length} stop${validRows.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}
