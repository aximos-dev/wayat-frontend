import type { ReactNode } from "react";

/** Shared backdrop + animated panel chrome for every modal in the app — see index.css for the
 *  entrance animation keyframes. */
export function Modal({
  children,
  maxWidthClassName = "max-w-lg",
}: {
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <div className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`animate-modal-panel w-full ${maxWidthClassName} max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-bg-surface p-6 shadow-2xl`}
      >
        {children}
      </div>
    </div>
  );
}
