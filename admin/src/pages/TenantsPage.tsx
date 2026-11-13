import { useState, type FormEvent } from "react";
import clsx from "clsx";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { PhoneInput } from "../components/PhoneInput";
import { useAuth } from "../lib/AuthContext";
import {
  useAddTenantAdmin,
  useCreatePlatformTenant,
  usePlatformTenants,
  useTenantAdmins,
  type PlatformTenant,
} from "../lib/platform";
import { useToast } from "../lib/ToastContext";
import type { ApiError } from "../lib/types";

function errorText(err: unknown, fallback: string) {
  return isAxiosError<ApiError>(err) ? (err.response?.data?.message ?? fallback) : fallback;
}

function TypeBadge({ tenant }: { tenant: PlatformTenant }) {
  return tenant.type === "OPERATOR" ? (
    <span className="rounded-full bg-accent-bg px-2 py-0.5 text-xs font-medium text-accent-muted">Our fleet</span>
  ) : (
    <span className="rounded-full bg-neutral-bg px-2 py-0.5 text-xs font-medium text-neutral">
      School · {tenant.billingModel === "A" ? "school pays" : "parents pay"}
    </span>
  );
}

/**
 * Every partner school and every one of our fleets, with their numbers — and the one place a new
 * school or fleet is set up: the tenant, its first admin and its code, in one step.
 */
export function TenantsPage() {
  const tenants = usePlatformTenants();
  const { actAs } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"ALL" | "OPERATOR" | "SCHOOL">("ALL");
  const [query, setQuery] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [adminsOf, setAdminsOf] = useState<PlatformTenant | null>(null);

  const q = query.trim().toLowerCase();
  const rows = (tenants.data ?? []).filter((t) => (filter === "ALL" || t.type === filter) && (!q || t.name.toLowerCase().includes(q) || t.inviteCode.toLowerCase().includes(q)));

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Schools & fleets</h1>
          <p className="mt-1 text-sm text-text-muted">
            Partner schools that run their own vans, and our own fleets. Open one to work inside it — your changes are logged as wayAt ops.
          </p>
        </div>
        <button type="button" onClick={() => setOnboarding(true)} className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base">
          Onboard a school or fleet
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border bg-bg-surface p-0.5">
          {(
            [
              ["ALL", "All"],
              ["OPERATOR", "Our fleets"],
              ["SCHOOL", "Partner schools"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={clsx("rounded px-3 py-1.5 text-sm", filter === key ? "bg-accent-bg text-accent-muted" : "text-text-muted hover:text-text-primary")}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or code"
          className="min-w-64 flex-1 rounded-md border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-bg-surface">
        {tenants.isLoading ? (
          <p className="p-6 text-sm text-text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-text-muted">Nothing matches.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Schools</th>
                <th className="px-4 py-3 font-medium">Routes</th>
                <th className="px-4 py-3 font-medium">Vans</th>
                <th className="px-4 py-3 font-medium">Drivers</th>
                <th className="px-4 py-3 font-medium">Children</th>
                <th className="px-4 py-3 font-medium">Waiting</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{t.name}</p>
                    <div className="mt-1">
                      <TypeBadge tenant={t} />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-primary">{t.inviteCode}</td>
                  <td className="px-4 py-3 text-text-primary">{t.schools}</td>
                  <td className="px-4 py-3 text-text-primary">{t.routes}</td>
                  <td className="px-4 py-3 text-text-primary">{t.vehicles}</td>
                  <td className="px-4 py-3 text-text-primary">{t.drivers}</td>
                  <td className="px-4 py-3 text-text-primary">{t.children}</td>
                  <td className="px-4 py-3">
                    {t.pendingRequests + t.waitlisted === 0 ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <span className="text-text-primary">
                        {t.pendingRequests > 0 && <span className="text-warning">{t.pendingRequests} to approve</span>}
                        {t.pendingRequests > 0 && t.waitlisted > 0 && " · "}
                        {t.waitlisted > 0 && `${t.waitlisted} waitlisted`}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button type="button" onClick={() => setAdminsOf(t)} className="mr-4 text-sm text-text-muted hover:text-text-primary">
                      Admins ({t.admins})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        actAs(t.id);
                        navigate("/routes-stops");
                      }}
                      className="text-sm text-accent-muted hover:text-accent"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {onboarding && <OnboardModal onClose={() => setOnboarding(false)} />}
      {adminsOf && <AdminsModal tenant={adminsOf} onClose={() => setAdminsOf(null)} />}
    </div>
  );
}

function OnboardModal({ onClose }: { onClose: () => void }) {
  const create = useCreatePlatformTenant();
  const { showError } = useToast();
  const [type, setType] = useState<"SCHOOL" | "OPERATOR">("SCHOOL");
  const [billing, setBilling] = useState<"A" | "B">("A");
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [created, setCreated] = useState<PlatformTenant | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setCreated(await create.mutateAsync({ name, type, billingModel: type === "SCHOOL" ? billing : undefined, adminName, adminPhone }));
    } catch (err) {
      showError(errorText(err, "Couldn't create it"));
    }
  }

  if (created) {
    return (
      <Modal>
        <h2 className="text-lg font-semibold text-text-primary">{created.name} is set up</h2>
        <p className="mt-2 text-sm text-text-muted">
          {adminName} can sign in to the admin app now with {adminPhone}.{" "}
          {created.type === "SCHOOL"
            ? "Next they add the school's location, vans, drivers and routes — or open it here and do it for them."
            : "Next, add its vans and drivers; schools get added as families ask for them (the demand board)."}
        </p>
        <div className="mt-4 rounded-xl border border-border bg-bg-base p-4">
          <p className="text-xs text-text-muted">{created.type === "SCHOOL" ? "School code for parents" : "Fleet code"}</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-widest text-accent">{created.inviteCode}</p>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base">
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal>
      <form onSubmit={(e) => void submit(e)}>
        <h2 className="text-lg font-semibold text-text-primary">Onboard a school or fleet</h2>
        <p className="mt-1 text-sm text-text-muted">Creates it with its first admin. They sign in with their phone straight away.</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {(
            [
              ["SCHOOL", "Partner school", "Runs its own vans; parents join with the school's code."],
              ["OPERATOR", "Our own fleet", "Our vans, serving many schools; parents pay a plan."],
            ] as const
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className={clsx(
                "rounded-xl border p-3 text-left transition-colors",
                type === key ? "border-accent bg-accent-bg" : "border-border bg-bg-base hover:border-text-muted",
              )}
            >
              <p className={clsx("text-sm font-medium", type === key ? "text-accent-muted" : "text-text-primary")}>{label}</p>
              <p className="mt-0.5 text-xs text-text-muted">{hint}</p>
            </button>
          ))}
        </div>

        <label className="mt-4 flex flex-col gap-1.5 text-sm text-text-muted">
          {type === "SCHOOL" ? "School name" : "Fleet name"}
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "SCHOOL" ? "e.g. Delhi Public School, Whitefield" : "e.g. wayAt Fleet — Hyderabad"}
            className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary placeholder:text-text-muted"
          />
        </label>

        {type === "SCHOOL" && (
          <label className="mt-4 flex flex-col gap-1.5 text-sm text-text-muted">
            Who pays
            <select value={billing} onChange={(e) => setBilling(e.target.value as "A" | "B")} className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary">
              <option value="A">The school pays per student</option>
              <option value="B">Parents pay a monthly plan in the app</option>
            </select>
          </label>
        )}

        <p className="mt-5 text-sm font-medium text-text-primary">First admin</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            Name
            <input required value={adminName} onChange={(e) => setAdminName(e.target.value)} className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            Phone
            <PhoneInput required value={adminPhone} onChange={setAdminPhone} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-text-muted hover:text-text-primary">
            Cancel
          </button>
          <button type="submit" disabled={create.isPending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-40">
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdminsModal({ tenant, onClose }: { tenant: PlatformTenant; onClose: () => void }) {
  const admins = useTenantAdmins(tenant.id);
  const add = useAddTenantAdmin(tenant.id);
  const { showSuccess, showError } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await add.mutateAsync({ name, phone });
      showSuccess(`${created.name} can sign in now`);
      setName("");
      setPhone("");
    } catch (err) {
      showError(errorText(err, "Couldn't add the admin"));
    }
  }

  return (
    <Modal>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Admins · {tenant.name}</h2>
          <p className="mt-1 text-sm text-text-muted">Everyone who signs in to the admin app for it.</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-text-muted hover:text-text-primary">
          Close
        </button>
      </div>

      <div className="rounded-xl border border-border bg-bg-base">
        {admins.isLoading ? (
          <p className="p-4 text-sm text-text-muted">Loading…</p>
        ) : (admins.data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-text-muted">No admins yet.</p>
        ) : (
          admins.data!.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-border px-4 py-2.5 text-sm last:border-0">
              <span className="text-text-primary">{a.name}</span>
              <span className="text-text-muted">{a.phone}</span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={(e) => void submit(e)} className="mt-5">
        <p className="text-sm font-medium text-text-primary">Add an admin</p>
        <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            Name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-border bg-bg-base px-3 py-2 text-text-primary" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-text-muted">
            Phone
            <PhoneInput required value={phone} onChange={setPhone} />
          </label>
          <button type="submit" disabled={add.isPending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg-base disabled:opacity-40">
            Add
          </button>
        </div>
      </form>
    </Modal>
  );
}
