import type { ReactNode } from "react";

/** Small "i in a circle" glyph — the standard trigger for an inline `Tooltip` holding the
 *  longer version of a one-line hint, so the visible copy next to it can stay short. */
export function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="5.3" r="0.9" fill="currentColor" />
      <rect x="7.25" y="7.1" width="1.5" height="4.3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

/** Wraps any trigger element and reveals `content` in a floating popover on hover/focus.
 *  `align="right"` anchors the popover's right edge to the trigger's instead of centering it —
 *  use it for triggers that sit at the right edge of their container (e.g. a table's last
 *  column), where a centered popover would run off the visible area. */
export function Tooltip({
  trigger,
  content,
  align = "center",
}: {
  trigger: ReactNode;
  content: ReactNode;
  align?: "center" | "right";
}) {
  return (
    <span className="group relative inline-flex">
      {trigger}
      <span
        role="tooltip"
        className={
          "pointer-events-none absolute top-full z-10 mt-2 w-max max-w-64 rounded-md border border-border bg-bg-base px-3 py-2 text-xs leading-relaxed text-text-muted opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 " +
          (align === "right" ? "right-0" : "left-1/2 -translate-x-1/2")
        }
      >
        {content}
      </span>
    </span>
  );
}
