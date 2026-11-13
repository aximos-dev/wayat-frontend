import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  useCreateSchoolClass,
  useCreateSection,
  useDeleteSchoolClass,
  useDeleteSection,
  useSchoolClasses,
  useSections,
  useStudents,
  useUpdateSchoolClass,
  useUpdateSection,
} from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import type { ApiError, SchoolClass } from "../lib/types";
import { Modal } from "./Modal";
import { InfoIcon, Tooltip } from "./Tooltip";

function handleApiError(err: unknown, showError: (msg: string) => void) {
  if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
    showError(err.response.data.message);
  } else {
    showError("Something went wrong.");
  }
}

/** One inline add/rename/delete row — identical shape for a class or a section, just handed
 *  different data and callbacks, so both halves of this modal share it instead of duplicating
 *  the same edit-in-place UI twice. */
function EditableRow({
  name,
  usageCount,
  usageLabel,
  onRename,
  onDelete,
  renamePending,
}: {
  name: string;
  usageCount: number;
  usageLabel: string;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => void;
  renamePending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    await onRename(trimmed);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-bg-base px-3 py-2">
      {editing ? (
        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="flex-1 rounded-md border border-border bg-bg-surface px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!draft.trim() || renamePending}
            className="text-xs font-medium text-accent-muted hover:text-accent disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(name);
              setEditing(false);
            }}
            className="text-xs text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <span className="flex-1 truncate text-sm text-text-primary">{name}</span>
          {usageCount > 0 && (
            <span className="shrink-0 rounded-full bg-accent-bg px-2 py-0.5 text-xs text-accent-muted">
              {usageCount} {usageLabel}
              {usageCount === 1 ? "" : "s"}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              // Re-seed from the current `name` prop, not whatever `draft` was left holding —
              // the "Selected class" row below reuses one EditableRow instance across different
              // classes (no per-item `key`, unlike the list rows), so without this, switching
              // the selected class and clicking Edit could open a stale draft from a
              // previously-edited class and silently rename the wrong one to it.
              setDraft(name);
              setEditing(true);
            }}
            className="shrink-0 text-xs text-text-muted hover:text-text-primary"
          >
            Edit
          </button>
          {usageCount > 0 ? (
            <Tooltip
              align="right"
              trigger={<span className="shrink-0 cursor-not-allowed text-xs text-text-muted opacity-40">Delete</span>}
              content={`${usageCount} student${usageCount === 1 ? "" : "s"} ${usageCount === 1 ? "is" : "are"} in here. Move them first.`}
            />
          ) : (
            <button
              type="button"
              onClick={onDelete}
              className="shrink-0 text-xs text-text-muted hover:text-danger"
            >
              Delete
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function ClassSectionModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const schoolClasses = useSchoolClasses(tenantId);
  const sections = useSections(tenantId);
  const students = useStudents(tenantId);
  const createClass = useCreateSchoolClass();
  const updateClass = useUpdateSchoolClass(tenantId);
  const deleteClass = useDeleteSchoolClass(tenantId);
  const createSection = useCreateSection(tenantId);
  const updateSection = useUpdateSection(tenantId);
  const deleteSection = useDeleteSection(tenantId);
  const { showSuccess, showError } = useToast();

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");

  const studentCountBySectionId = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students.data ?? []) {
      map.set(s.sectionId, (map.get(s.sectionId) ?? 0) + 1);
    }
    return map;
  }, [students.data]);

  const sectionsForSelectedClass = useMemo(
    () => (sections.data ?? []).filter((s) => s.classId === selectedClassId),
    [sections.data, selectedClassId],
  );

  const studentCountByClassId = useMemo(() => {
    const map = new Map<string, number>();
    for (const section of sections.data ?? []) {
      const count = studentCountBySectionId.get(section.id) ?? 0;
      map.set(section.classId, (map.get(section.classId) ?? 0) + count);
    }
    return map;
  }, [sections.data, studentCountBySectionId]);

  const selectedClass: SchoolClass | undefined = schoolClasses.data?.find((c) => c.id === selectedClassId);

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    try {
      const created = await createClass.mutateAsync({ tenantId, name });
      setNewClassName("");
      setSelectedClassId(created.id);
      showSuccess("Class added");
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault();
    const name = newSectionName.trim();
    if (!name || !selectedClassId) return;
    try {
      await createSection.mutateAsync({ classId: selectedClassId, name });
      setNewSectionName("");
      showSuccess("Section added");
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  return (
    <Modal maxWidthClassName="max-w-2xl">
      <h2 className="text-lg font-semibold text-text-primary">Classes & sections</h2>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
        Every student belongs to one section, under one class.
        <Tooltip
          trigger={<InfoIcon className="h-3.5 w-3.5 text-text-muted hover:text-accent-muted" />}
          content="Select a class on the left to manage its sections on the right. Importing a CSV with a new class/section name creates it automatically too."
        />
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted">Classes</span>
          {schoolClasses.isLoading && <p className="px-1 text-sm text-text-muted">Loading…</p>}
          {schoolClasses.data?.length === 0 && (
            <p className="px-1 text-sm text-text-muted">No classes yet. Add one below.</p>
          )}
          {schoolClasses.data?.map((schoolClass) => (
            <button
              key={schoolClass.id}
              type="button"
              onClick={() => setSelectedClassId(schoolClass.id)}
              className={
                "rounded-md px-3 py-2 text-left text-sm transition-colors " +
                (selectedClassId === schoolClass.id
                  ? "bg-accent-bg text-accent-muted"
                  : "bg-bg-base text-text-primary hover:bg-accent-bg/40")
              }
            >
              {schoolClass.name}
            </button>
          ))}
          <form
            onSubmit={handleAddClass}
            className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2"
          >
            <span className="text-accent-muted">+</span>
            <input
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="New class, e.g. Grade 5"
              className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            <button
              type="submit"
              disabled={!newClassName.trim() || createClass.isPending}
              className="text-xs font-medium text-accent-muted hover:text-accent disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted">
            Sections{selectedClass ? ` — ${selectedClass.name}` : ""}
          </span>
          {!selectedClass && (
            <p className="px-1 text-sm text-text-muted">Select a class on the left first.</p>
          )}
          {selectedClass && (
            <>
              {sectionsForSelectedClass.length === 0 && (
                <p className="px-1 text-sm text-text-muted">No sections yet. Add one below.</p>
              )}
              {sectionsForSelectedClass.map((section) => (
                <EditableRow
                  key={section.id}
                  name={section.name}
                  usageCount={studentCountBySectionId.get(section.id) ?? 0}
                  usageLabel="student"
                  renamePending={updateSection.isPending}
                  onRename={async (newName) => {
                    try {
                      await updateSection.mutateAsync({ sectionId: section.id, request: { name: newName } });
                      showSuccess("Section renamed");
                    } catch (err) {
                      handleApiError(err, showError);
                    }
                  }}
                  onDelete={() =>
                    deleteSection.mutate(section.id, {
                      onSuccess: () => showSuccess("Section deleted"),
                      onError: (err) => handleApiError(err, showError),
                    })
                  }
                />
              ))}
              <form
                onSubmit={handleAddSection}
                className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2"
              >
                <span className="text-accent-muted">+</span>
                <input
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="New section, e.g. A"
                  className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
                />
                <button
                  type="submit"
                  disabled={!newSectionName.trim() || createSection.isPending}
                  className="text-xs font-medium text-accent-muted hover:text-accent disabled:opacity-40"
                >
                  Add
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {selectedClass && (
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-xs uppercase tracking-wide text-text-muted">Selected class</span>
          <EditableRow
            name={selectedClass.name}
            usageCount={studentCountByClassId.get(selectedClass.id) ?? 0}
            usageLabel="student"
            renamePending={updateClass.isPending}
            onRename={async (newName) => {
              try {
                await updateClass.mutateAsync({ classId: selectedClass.id, request: { name: newName } });
                showSuccess("Class renamed");
              } catch (err) {
                handleApiError(err, showError);
              }
            }}
            onDelete={() =>
              deleteClass.mutate(selectedClass.id, {
                onSuccess: () => {
                  setSelectedClassId(null);
                  showSuccess("Class deleted");
                },
                onError: (err) => handleApiError(err, showError),
              })
            }
          />
        </div>
      )}

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
