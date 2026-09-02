"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** Shown in the header and used as the dialog's accessible name. */
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Override for denser forms. Every existing modal used max-w-md. */
  maxWidthClass?: string;
  /** Optional control rendered to the left of the close button, e.g. an Edit/View toggle. */
  headerExtra?: React.ReactNode;
};

/**
 * The one modal wrapper.
 *
 * All five dashboard modals previously inlined an identical shell that had no
 * height cap and no scroll, so any modal taller than the viewport was centred
 * and clipped at both ends with no way to reach its submit button. That is the
 * bug this exists to fix.
 *
 * The cap lives on the CARD, not on this container. Putting `overflow-y-auto`
 * on a `flex items-center` container clips the top of an overflowing child
 * instead of letting it scroll — a well-known flexbox trap. Letting the card
 * scroll inside a non-scrolling centred container avoids it entirely.
 *
 * `100dvh`, never `100vh`. Mobile Safari's `vh` measures the viewport *behind*
 * the URL bar, so a vh-based cap reintroduces the exact clipping being fixed.
 *
 * RENDERED THROUGH A PORTAL, and that is load-bearing. `position: fixed` is
 * resolved against the nearest ancestor carrying a transform, filter or
 * backdrop-filter — not against the viewport. This app has two such ancestors
 * on every dashboard screen: `.dashboard-fade-in` (whose animation uses
 * fill-mode `both`, so `transform: translateY(0)` sticks permanently after it
 * finishes) and the panels' `hover:-translate-y-0.5`, which is active precisely
 * because the cursor is over the button that opened the modal. Rendered in
 * place, `inset-0` resolved to a tall scrolled container while `max-h` still
 * measured the viewport, so the card hung off the top of the screen on every
 * size. Portalling to `document.body` puts it beyond the reach of any of that.
 */
export function ModalShell({ title, onClose, children, maxWidthClass = "max-w-md", headerExtra }: Props) {
  // The portal target only exists in the browser. Modals open on interaction,
  // so rendering nothing during SSR costs nothing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    // Stop the page behind the modal from scrolling under the user's finger.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className={`bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-4 sm:p-6 w-full ${maxWidthClass} shadow-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto`}
      >
        <div className="flex items-start justify-between mb-5 gap-3">
          <p className="text-sm font-semibold text-white leading-snug">{title}</p>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center text-lg leading-none text-zinc-500 transition-colors hover:text-white sm:h-6 sm:w-6"
            >
              ✕
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
