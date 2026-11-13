import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { isAxiosError } from "axios";
import { downloadTextFile, splitCsvLine, splitCsvLines } from "../lib/csv";
import { useBulkCreateStudents } from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, BulkCreateStudentRow } from "../lib/types";
import { Modal } from "./Modal";
import { Tooltip } from "./Tooltip";

interface ParsedRow extends BulkCreateStudentRow {
  rowIndex: number;
  parseError: string | null;
}

type SubmitOutcome = { status: "created" | "failed"; message?: string };

const RELATIONS = new Set(["father", "mother", "guardian", "other"]);
const TEMPLATE_CSV =
  "firstName,lastName,admissionNo,className,sectionName,parent1FirstName,parent1LastName,parent1Phone,parent1Relation,parent2FirstName,parent2LastName,parent2Phone,parent2Relation\n" +
  "Aarav,Rao,ADM-2026-001,Grade 3,A,Kavita,Shankar,+919900099001,Mother,Shankar,Rao,+919900099011,Father\n" +
  "Rohan,Mehta,ADM-2026-002,Grade 3,A,Suresh,Mehta,+919900099002,Father,,,,\n";

// Loose check, not a strict E.164 validator — just enough to catch an obviously wrong value.
function looksLikePhone(value: string): boolean {
  const digitsOnly = value.replace(/[\s-]/g, "");
  return /^\+?\d{7,15}$/.test(digitsOnly);
}

function parseCsv(text: string): ParsedRow[] {
  const lines = splitCsvLines(text);
  if (lines.length === 0) return [];

  // Several text columns in a row, so there's no single numeric column to key a header
  // heuristic off of — instead, check whether the parent1Phone column (index 7) looks like a
  // header label rather than an actual phone number.
  let dataLines = lines;
  const firstFields = splitCsvLine(lines[0]);
  const looksLikeHeader = firstFields.length >= 8 && !looksLikePhone(firstFields[7] ?? "");
  if (looksLikeHeader) {
    dataLines = lines.slice(1);
  }

  const rows: ParsedRow[] = dataLines.map((line, rowIndex) => {
    const fields = splitCsvLine(line);
    const firstName = (fields[0] ?? "").trim();
    const lastName = (fields[1] ?? "").trim();
    const admissionNo = (fields[2] ?? "").trim();
    const className = (fields[3] ?? "").trim();
    const sectionName = (fields[4] ?? "").trim();
    const parent1FirstName = (fields[5] ?? "").trim();
    const parent1LastName = (fields[6] ?? "").trim();
    const parent1Phone = (fields[7] ?? "").trim();
    const parent1Relation = (fields[8] ?? "").trim();
    const parent2FirstName = (fields[9] ?? "").trim();
    const parent2LastName = (fields[10] ?? "").trim();
    const parent2Phone = (fields[11] ?? "").trim();
    const parent2Relation = (fields[12] ?? "").trim();

    let parseError: string | null = null;
    if (fields.length < 9) {
      parseError = "Expected at least firstName, lastName, admissionNo, className, sectionName, parent1FirstName, parent1LastName, parent1Phone, parent1Relation";
    } else if (!firstName) {
      parseError = "Student first name is required";
    } else if (!admissionNo) {
      parseError = "Admission no. is required";
    } else if (!className) {
      parseError = "Class is required";
    } else if (!sectionName) {
      parseError = "Section is required";
    } else if (!parent1FirstName || !parent1Phone || !parent1Relation) {
      parseError = "Guardian 1 first name, phone, and relation are all required";
    } else if (!looksLikePhone(parent1Phone)) {
      parseError = "Guardian 1 phone doesn't look like a valid number";
    } else if (!RELATIONS.has(parent1Relation.toLowerCase())) {
      parseError = `"${parent1Relation}" isn't a valid relation — use Father, Mother, Guardian, or Other`;
    } else {
      const hasSecond = parent2FirstName || parent2Phone || parent2Relation;
      if (hasSecond) {
        if (!parent2FirstName || !parent2Phone || !parent2Relation) {
          parseError = "Guardian 2 first name, phone, and relation must all be filled in together, or all left blank";
        } else if (!looksLikePhone(parent2Phone)) {
          parseError = "Guardian 2 phone doesn't look like a valid number";
        } else if (!RELATIONS.has(parent2Relation.toLowerCase())) {
          parseError = `"${parent2Relation}" isn't a valid relation — use Father, Mother, Guardian, or Other`;
        }
      }
    }

    return {
      rowIndex,
      firstName,
      lastName: lastName || undefined,
      admissionNo,
      className,
      sectionName,
      parent1FirstName,
      parent1LastName: parent1LastName || undefined,
      parent1Phone,
      parent1Relation,
      parent2FirstName: parent2FirstName || undefined,
      parent2LastName: parent2LastName || undefined,
      parent2Phone: parent2Phone || undefined,
      parent2Relation: parent2Relation || undefined,
      parseError,
    };
  });

  // A second pass so a duplicate admission number *within this paste* is flagged client-side
  // too, not just one that collides with a student already in the database.
  const firstSeenAt = new Map<string, number>();
  for (const row of rows) {
    if (row.parseError) continue;
    const key = row.admissionNo.toLowerCase();
    const earlierRow = firstSeenAt.get(key);
    if (earlierRow !== undefined) {
      row.parseError = `Duplicate admission no. in this list (same as row ${earlierRow + 1})`;
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
        trigger={<span className="cursor-default rounded-full bg-danger-bg px-2 py-0.5 text-xs text-danger">Invalid</span>}
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
        trigger={<span className="cursor-default rounded-full bg-danger-bg px-2 py-0.5 text-xs text-danger">Failed</span>}
        content={outcome.message}
      />
    );
  }
  return <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xs text-neutral">Ready</span>;
}

export function BulkImportStudentsModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const bulkCreate = useBulkCreateStudents(tenantId);
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
        children: validRows.map(({ rowIndex: _rowIndex, parseError: _parseError, ...row }) => row),
      });

      const outcome = new Map<number, SubmitOutcome>();
      validRows.forEach((r) => outcome.set(r.rowIndex, { status: "created" }));
      result.failed.forEach((f) => {
        const row = validRows[f.index];
        if (row) outcome.set(row.rowIndex, { status: "failed", message: f.message });
      });
      setSubmitOutcome(outcome);

      if (result.created.length > 0) {
        showSuccess(`${result.created.length} student${result.created.length === 1 ? "" : "s"} added`);
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
    <Modal maxWidthClassName="max-w-4xl">
      <h2 className="text-lg font-semibold text-text-primary">Import students from CSV</h2>
      <p className="mt-1 text-sm text-text-muted">
        Columns: firstName, lastName, admissionNo, className, sectionName, parent1FirstName,
        parent1LastName, parent1Phone, parent1Relation, parent2FirstName, parent2LastName,
        parent2Phone, parent2Relation (every lastName and the whole second guardian are
        optional). A new class/section name is created automatically. Two rows sharing a
        parent's phone number link to the same parent — that's how siblings work.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-text-muted">Paste or upload</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => downloadTextFile("students-template.csv", TEMPLATE_CSV)}
              className="text-xs font-medium text-accent-muted hover:underline"
            >
              Download template
            </button>
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
          placeholder={"firstName,lastName,admissionNo,className,sectionName,parent1FirstName,parent1LastName,parent1Phone,parent1Relation,..."}
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
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Admission no.</th>
                  <th className="px-3 py-2 font-medium">Class / Section</th>
                  <th className="px-3 py-2 font-medium">Guardian(s)</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowIndex} className="border-t border-border">
                    <td className="px-3 py-1.5 text-text-muted">{row.rowIndex + 1}</td>
                    <td className="px-3 py-1.5 text-text-primary">
                      {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-text-muted">{row.admissionNo || "—"}</td>
                    <td className="px-3 py-1.5 text-text-muted">
                      {row.className || "—"} / {row.sectionName || "—"}
                    </td>
                    <td className="px-3 py-1.5 text-text-muted">
                      {[
                        [row.parent1FirstName, row.parent1LastName].filter(Boolean).join(" "),
                        [row.parent2FirstName, row.parent2LastName].filter(Boolean).join(" "),
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
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
          disabled={validRows.length === 0 || bulkCreate.isPending || submitOutcome.size > 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
        >
          {bulkCreate.isPending
            ? "Importing…"
            : `Import ${validRows.length} student${validRows.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </Modal>
  );
}
