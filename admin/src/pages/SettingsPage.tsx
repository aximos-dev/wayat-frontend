import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { SchoolSection } from "../components/SchoolSection";

type Tab = "general" | "profile";

export function SettingsPage() {
  const { principal } = useAuth();
  const tenantId = principal!.tenantId;
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Tenant-wide configuration that applies across every route, every bus, every day.
        </p>
      </div>

      <div className="mb-6 flex gap-1 border-b border-border">
        {(["general", "profile"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm capitalize transition-colors " +
              (tab === t
                ? "border-accent text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="flex flex-col gap-6">
          <SchoolSection tenantId={tenantId} />
        </div>
      )}

      {tab === "profile" && (
        <div className="max-w-xl rounded-xl border border-border bg-bg-surface p-6">
          <p className="text-sm text-text-muted">Not built yet.</p>
        </div>
      )}
    </div>
  );
}
