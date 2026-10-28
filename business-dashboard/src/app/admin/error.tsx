"use client";

import { useEffect } from "react";

// Catches a failed page inside the dashboard shell, so the menu and the other
// sections stay usable. The digest matches the server log entry.
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="bg-[#FFFFFF] border border-[#DCE1E8] rounded-[4px] p-6 text-center">
      <p className="text-base font-semibold text-[#1B2533]">This section did not load</p>
      <p className="mt-1 text-sm text-[#5A6678]">Nothing was saved or changed. Try again, or open another section from the menu.</p>
      {error.digest && <p className="mt-2 font-mono text-[10px] text-[#6B7789]">Ref {error.digest}</p>}
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-4 min-h-11 rounded-[4px] bg-[#1D4ED8] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]/80"
      >
        Try again
      </button>
    </div>
  );
}
