import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  useAddGuardian,
  useCreateStudent,
  useParents,
  useRemoveGuardian,
  useSchoolClasses,
  useSections,
  useStops,
  useUpdateStudent,
} from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, Parent, Student } from "../lib/types";
import { Modal } from "./Modal";
import { InfoIcon, Tooltip } from "./Tooltip";

const NONE = "";
const RELATIONS = ["Father", "Mother", "Guardian", "Other"];

function handleApiError(err: unknown, showError: (msg: string) => void) {
  if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
    showError(err.response.data.message);
  } else {
    showError("Something went wrong.");
  }
}

/** Search-and-pick an EXISTING parent by name, then choose their relation to this student — no
 *  name/phone is ever typed inline here. Parents must already exist (added in the Parents tab)
 *  before they can be picked, which is the whole point: a Parent is a managed directory entry,
 *  not a side effect of adding a kid. */
function GuardianSearchPicker({
  tenantId,
  excludeParentIds,
  onAdd,
  pending,
}: {
  tenantId: string;
  excludeParentIds: string[];
  onAdd: (parent: Parent, relation: string) => void;
  pending?: boolean;
}) {
  const parents = useParents(tenantId);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Parent | null>(null);
  const [relation, setRelation] = useState("Guardian");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (parents.data ?? [])
      .filter((p) => !excludeParentIds.includes(p.id))
      .filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q))
      .slice(0, 6);
  }, [parents.data, query, excludeParentIds]);

  function handleConfirm() {
    if (!selected) return;
    onAdd(selected, relation);
    setSelected(null);
    setQuery("");
    setRelation("Guardian");
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2">
        <span className="flex-1 truncate text-sm text-text-primary">{selected.name}</span>
        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          className="rounded-md border border-border bg-bg-surface px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        >
          {RELATIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="text-xs font-medium text-accent-muted hover:text-accent disabled:opacity-40"
        >
          Add
        </button>
        <button type="button" onClick={() => setSelected(null)} className="text-xs text-text-muted hover:text-text-primary">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search parent by name or phone…"
        className="w-full rounded-md border border-dashed border-border bg-transparent px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent"
      />
      {matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-bg-surface shadow-lg">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelected(p);
                setQuery("");
              }}
              className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-accent-bg/40"
            >
              {p.name} <span className="text-xs text-text-muted">· {p.phone}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim() !== "" && matches.length === 0 && (
        <p className="mt-1 text-xs text-text-muted">No matching parent — add them in the Parents tab first.</p>
      )}
    </div>
  );
}

export function StudentModal({
  tenantId,
  student,
  onClose,
}: {
  tenantId: string;
  /** Omit to create a new student; pass an existing one to edit it. */
  student?: Student;
  onClose: () => void;
}) {
  const isEditing = student != null;
  const schoolClasses = useSchoolClasses(tenantId);
  const sections = useSections(tenantId);
  const stops = useStops(tenantId);
  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent(tenantId);
  const addGuardian = useAddGuardian(tenantId);
  const removeGuardian = useRemoveGuardian(tenantId);
  const { showSuccess, showError } = useToast();

  const [firstName, setFirstName] = useState(student?.firstName ?? "");
  const [lastName, setLastName] = useState(student?.lastName ?? "");
  const [admissionNo, setAdmissionNo] = useState(student?.admissionNo ?? "");
  const [classId, setClassId] = useState(student?.classId ?? NONE);
  const [sectionId, setSectionId] = useState(student?.sectionId ?? NONE);
  const [assignedStopId, setAssignedStopId] = useState(student?.assignedStopId ?? NONE);
  const [newGuardians, setNewGuardians] = useState<{ parent: Parent; relation: string }[]>([]);

  const sectionsForClass = useMemo(
    () => (sections.data ?? []).filter((s) => s.classId === classId),
    [sections.data, classId],
  );

  function handleClassChange(newClassId: string) {
    setClassId(newClassId);
    setSectionId(NONE);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateStudent.mutateAsync({
          studentId: student.id,
          request: { firstName, lastName: lastName || null, admissionNo, sectionId, assignedStopId: assignedStopId || null },
        });
        showSuccess("Student updated");
        onClose();
      } else {
        await createStudent.mutateAsync({
          tenantId,
          firstName,
          lastName: lastName || null,
          admissionNo,
          sectionId,
          assignedStopId: assignedStopId || null,
          guardians: newGuardians.map((g) => ({ parentId: g.parent.id, relation: g.relation })),
        });
        showSuccess("Student added");
        onClose();
      }
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  function handleRemoveGuardian(parentId: string) {
    if (!student) return;
    removeGuardian.mutate(
      { studentId: student.id, parentId },
      {
        onSuccess: () => showSuccess("Guardian removed"),
        onError: (err) => handleApiError(err, showError),
      },
    );
  }

  function handleAddGuardianLive(parent: Parent, relation: string) {
    if (!student) return;
    addGuardian.mutate(
      { studentId: student.id, request: { parentId: parent.id, relation } },
      {
        onSuccess: () => showSuccess("Guardian added"),
        onError: (err) => handleApiError(err, showError),
      },
    );
  }

  const isSaving = createStudent.isPending || updateStudent.isPending;
  const excludeParentIds = isEditing
    ? student.guardians.map((g) => g.parentId)
    : newGuardians.map((g) => g.parent.id);
  const guardianCount = isEditing ? student.guardians.length : newGuardians.length;

  return (
    <Modal maxWidthClassName="max-w-xl">
      <h2 className="text-lg font-semibold text-text-primary">{isEditing ? "Edit student" : "Add a student"}</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">First name</span>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Aarav"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Last name</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Rao (optional)"
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-text-muted">Admission no.</span>
          <input
            required
            value={admissionNo}
            onChange={(e) => setAdmissionNo(e.target.value)}
            placeholder="e.g. ADM-2026-001"
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Class</span>
            <select
              required
              value={classId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
            >
              <option value={NONE} disabled>
                — Choose a class —
              </option>
              {schoolClasses.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">Section</span>
            <select
              required
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={!classId}
              className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent disabled:text-text-muted"
            >
              <option value={NONE} disabled>
                {classId ? "— Choose a section —" : "Choose a class first"}
              </option>
              {sectionsForClass.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-muted">
            Assigned stop
            <Tooltip
              trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
              content="Optional. A student only shows up on a ride once both a stop here and a route covering that stop exist — leave unassigned until then."
            />
          </span>
          <select
            value={assignedStopId}
            onChange={(e) => setAssignedStopId(e.target.value)}
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary outline-none focus:border-accent"
          >
            <option value={NONE}>— None —</option>
            {stops.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-md bg-bg-base p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-primary">
            Guardians
            <Tooltip
              trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
              content="Picked from parents already added in the Parents tab — add a parent there first if they're not showing up here."
            />
          </span>

          <div className="mt-2 flex flex-col gap-2">
            {isEditing
              ? student.guardians.map((g) => (
                  <div key={g.parentId} className="flex items-center gap-3 rounded-md bg-bg-surface px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{g.name}</p>
                      <p className="text-xs text-text-muted">
                        {g.phone} · {g.relation.charAt(0) + g.relation.slice(1).toLowerCase()}
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-xs " +
                        (g.invitedAt ? "bg-success-bg text-success" : "bg-neutral-bg text-neutral")
                      }
                    >
                      {g.invitedAt ? "Invited" : "Not invited"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveGuardian(g.parentId)}
                      className="shrink-0 text-xs text-text-muted hover:text-danger"
                    >
                      Remove
                    </button>
                  </div>
                ))
              : newGuardians.map((g, i) => (
                  <div key={g.parent.id} className="flex items-center gap-3 rounded-md bg-bg-surface px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary">{g.parent.name}</p>
                      <p className="text-xs text-text-muted">
                        {g.parent.phone} · {g.relation}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewGuardians((prev) => prev.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-xs text-text-muted hover:text-danger"
                    >
                      Remove
                    </button>
                  </div>
                ))}
          </div>

          {guardianCount < 2 && (
            <div className="mt-2">
              <GuardianSearchPicker
                tenantId={tenantId}
                excludeParentIds={excludeParentIds}
                pending={isEditing ? addGuardian.isPending : false}
                onAdd={
                  isEditing
                    ? handleAddGuardianLive
                    : (parent, relation) => setNewGuardians((prev) => [...prev, { parent, relation }])
                }
              />
            </div>
          )}
        </div>

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
            disabled={isSaving || (!isEditing && newGuardians.length === 0)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Save student"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
