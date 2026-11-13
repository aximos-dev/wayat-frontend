import { useState } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "../lib/AuthContext";
import { usePagedSearch } from "../lib/usePagedSearch";
import {
  useDeleteStudent,
  useParents,
  useSendParentInvite,
  useSendPendingInvites,
  useStudents,
} from "../lib/queries";
import { useToast } from "../lib/ToastContext";
import { BulkImportStudentsModal } from "../components/BulkImportStudentsModal";
import { ClassSectionModal } from "../components/ClassSectionModal";
import { ParentModal } from "../components/ParentModal";
import { PaginationBar, SearchBar } from "../components/SearchAndPagination";
import { StudentModal } from "../components/StudentModal";
import type { ApiError, Parent, Student } from "../lib/types";

type Tab = "students" | "parents" | "invites";

function handleApiError(err: unknown, showError: (msg: string) => void) {
  if (isAxiosError<ApiError>(err) && err.response?.data?.message) {
    showError(err.response.data.message);
  } else {
    showError("Something went wrong.");
  }
}

function studentMatches(student: Student, query: string): boolean {
  return student.name.toLowerCase().includes(query) || student.admissionNo.toLowerCase().includes(query);
}

function parentMatches(parent: Parent, query: string): boolean {
  return parent.name.toLowerCase().includes(query) || parent.phone.includes(query);
}

export function StudentManagementPage() {
  const { principal } = useAuth();
  const tenantId = principal!.tenantId;
  const [tab, setTab] = useState<Tab>("students");

  const [addStudentOpen, setAddStudentOpen] = useState(false);
  // An id, not the Student object itself — so that after adding/removing a guardian (which
  // invalidates and refetches students), the modal re-renders with the live guardian list
  // instead of the stale snapshot it was first opened with. Same reasoning for parents below.
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [manageClassesOpen, setManageClassesOpen] = useState(false);
  const [addParentOpen, setAddParentOpen] = useState(false);
  const [editingParentId, setEditingParentId] = useState<string | null>(null);

  const { showSuccess, showError } = useToast();

  const students = useStudents(tenantId);
  const parents = useParents(tenantId);
  const deleteStudent = useDeleteStudent(tenantId);
  const sendInvite = useSendParentInvite(tenantId);
  const sendPendingInvites = useSendPendingInvites(tenantId);

  // Independent search/page state per tab — the Parents and Invites tabs share the same
  // underlying `parents` data but are browsed separately, so paging through one shouldn't move
  // the other.
  const studentsSearch = usePagedSearch(students.data, studentMatches);
  const parentsSearch = usePagedSearch(parents.data, parentMatches);
  const invitesSearch = usePagedSearch(parents.data, parentMatches);

  const editingStudent = students.data?.find((s) => s.id === editingStudentId) ?? null;
  const editingParent = parents.data?.find((p) => p.id === editingParentId) ?? null;

  const studentCount = students.data?.length ?? 0;
  const parentCount = parents.data?.length ?? 0;
  const pendingCount = (parents.data ?? []).filter((p) => !p.invitedAt).length;

  function handleDeleteStudent(studentId: string) {
    deleteStudent.mutate(studentId, {
      onSuccess: () => showSuccess("Student deleted"),
      onError: (err) => handleApiError(err, showError),
    });
  }

  function handleSendInvite(parent: Parent) {
    sendInvite.mutate(parent.id, {
      onSuccess: () => showSuccess(`Invite sent to ${parent.name}`),
      onError: (err) => handleApiError(err, showError),
    });
  }

  async function handleSendPendingInvites() {
    try {
      const result = await sendPendingInvites.mutateAsync();
      showSuccess(`${result.sent} invite${result.sent === 1 ? "" : "s"} sent`);
    } catch (err) {
      handleApiError(err, showError);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Student Management</h1>
          <p className="mt-1 text-sm text-text-muted">
            {studentCount} student{studentCount === 1 ? "" : "s"} · {parentCount} parent{parentCount === 1 ? "" : "s"}
          </p>
        </div>
        {tab === "students" && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setManageClassesOpen(true)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary"
            >
              Classes & sections
            </button>
            <button
              type="button"
              onClick={() => setBulkImportOpen(true)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary"
            >
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setAddStudentOpen(true)}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
            >
              + Add student
            </button>
          </div>
        )}
        {tab === "parents" && (
          <button
            type="button"
            onClick={() => setAddParentOpen(true)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base"
          >
            + Add parent
          </button>
        )}
        {tab === "invites" && pendingCount > 0 && (
          <button
            type="button"
            onClick={() => void handleSendPendingInvites()}
            disabled={sendPendingInvites.isPending}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-50"
          >
            {sendPendingInvites.isPending ? "Sending…" : `Send invite to ${pendingCount} pending`}
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {(["students", "parents", "invites"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "rounded-md px-3 py-1.5 text-sm capitalize " +
                (tab === t ? "bg-accent-bg text-accent-muted" : "text-text-muted hover:text-text-primary")
              }
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "students" && (
          <SearchBar value={studentsSearch.query} onChange={studentsSearch.setQuery} placeholder="Search by name or admission no…" />
        )}
        {tab === "parents" && (
          <SearchBar value={parentsSearch.query} onChange={parentsSearch.setQuery} placeholder="Search by name or phone…" />
        )}
        {tab === "invites" && (
          <SearchBar value={invitesSearch.query} onChange={invitesSearch.setQuery} placeholder="Search by name or phone…" />
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {tab === "students" && (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Admission no.</th>
                  <th className="px-5 py-3 font-medium">Class / Section</th>
                  <th className="px-5 py-3 font-medium">Guardian(s)</th>
                  <th className="px-5 py-3 font-medium">Stop</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {students.isLoading && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>Loading…</td></tr>
                )}
                {!students.isLoading && studentCount === 0 && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>No students yet.</td></tr>
                )}
                {!students.isLoading && studentCount > 0 && studentsSearch.totalCount === 0 && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={6}>No students match "{studentsSearch.query}".</td></tr>
                )}
                {studentsSearch.paged.map((student) => (
                  <tr key={student.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                    <td className="px-5 py-3 font-medium text-text-primary">{student.name}</td>
                    <td className="px-5 py-3 text-text-muted">{student.admissionNo}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {student.className} / {student.sectionName}
                    </td>
                    <td className="px-5 py-3 text-text-muted">
                      {student.guardians.map((g) => g.name).join(", ")}
                    </td>
                    <td className="px-5 py-3 text-text-muted">{student.assignedStopName ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingStudentId(student.id)}
                          className="text-xs text-text-muted hover:text-text-primary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student.id)}
                          className="text-xs text-text-muted hover:text-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={studentsSearch.page}
              totalPages={studentsSearch.totalPages}
              totalCount={studentsSearch.totalCount}
              pageSize={studentsSearch.pageSize}
              onPageChange={studentsSearch.setPage}
            />
          </>
        )}

        {tab === "parents" && (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Children</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {parents.isLoading && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={4}>Loading…</td></tr>
                )}
                {!parents.isLoading && parentCount === 0 && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={4}>No parents yet.</td></tr>
                )}
                {!parents.isLoading && parentCount > 0 && parentsSearch.totalCount === 0 && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={4}>No parents match "{parentsSearch.query}".</td></tr>
                )}
                {parentsSearch.paged.map((parent) => (
                  <tr key={parent.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                    <td className="px-5 py-3 font-medium text-text-primary">{parent.name}</td>
                    <td className="px-5 py-3 text-text-muted">{parent.phone}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {parent.children.map((c) => c.name).join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingParentId(parent.id)}
                        className="text-xs text-text-muted hover:text-text-primary"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={parentsSearch.page}
              totalPages={parentsSearch.totalPages}
              totalCount={parentsSearch.totalCount}
              pageSize={parentsSearch.pageSize}
              onPageChange={parentsSearch.setPage}
            />
          </>
        )}

        {tab === "invites" && (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-accent-bg/40 text-xs uppercase tracking-wide text-accent-muted">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium">Children</th>
                  <th className="px-5 py-3 font-medium">Invite status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {parents.isLoading && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={5}>Loading…</td></tr>
                )}
                {!parents.isLoading && parentCount === 0 && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={5}>No parents yet — add some in the Parents tab first.</td></tr>
                )}
                {!parents.isLoading && parentCount > 0 && invitesSearch.totalCount === 0 && (
                  <tr><td className="px-5 py-4 text-text-muted" colSpan={5}>No parents match "{invitesSearch.query}".</td></tr>
                )}
                {invitesSearch.paged.map((parent) => (
                  <tr key={parent.id} className="border-t border-border transition-colors hover:bg-accent-bg/40">
                    <td className="px-5 py-3 font-medium text-text-primary">{parent.name}</td>
                    <td className="px-5 py-3 text-text-muted">{parent.phone}</td>
                    <td className="px-5 py-3 text-text-muted">
                      {parent.children.map((c) => c.name).join(", ") || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-xs " +
                          (parent.invitedAt ? "bg-success-bg text-success" : "bg-neutral-bg text-neutral")
                        }
                      >
                        {parent.invitedAt ? `Invited ${new Date(parent.invitedAt).toLocaleDateString()}` : "Not invited"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSendInvite(parent)}
                        disabled={sendInvite.isPending}
                        className="text-xs text-text-muted hover:text-text-primary disabled:opacity-40"
                      >
                        {parent.invitedAt ? "Resend" : "Send invite"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={invitesSearch.page}
              totalPages={invitesSearch.totalPages}
              totalCount={invitesSearch.totalCount}
              pageSize={invitesSearch.pageSize}
              onPageChange={invitesSearch.setPage}
            />
          </>
        )}
      </div>

      {addStudentOpen && (
        <StudentModal tenantId={tenantId} onClose={() => setAddStudentOpen(false)} />
      )}
      {editingStudent && (
        <StudentModal tenantId={tenantId} student={editingStudent} onClose={() => setEditingStudentId(null)} />
      )}
      {bulkImportOpen && (
        <BulkImportStudentsModal tenantId={tenantId} onClose={() => setBulkImportOpen(false)} />
      )}
      {manageClassesOpen && (
        <ClassSectionModal tenantId={tenantId} onClose={() => setManageClassesOpen(false)} />
      )}
      {addParentOpen && (
        <ParentModal tenantId={tenantId} onClose={() => setAddParentOpen(false)} />
      )}
      {editingParent && (
        <ParentModal tenantId={tenantId} parent={editingParent} onClose={() => setEditingParentId(null)} />
      )}
    </div>
  );
}
