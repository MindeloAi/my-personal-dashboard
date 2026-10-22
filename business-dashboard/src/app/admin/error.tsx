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
    <div className="bg-[#14181d] border border-[#2a2e34] rounded-[20px] p-6 text-center">
      <p className="text-base font-semibold text-white">This section did not load</p>
      <p className="mt-1 text-sm text-zinc-500">Nothing was saved or changed. Try again, or open another section from the menu.</p>
      {error.digest && <p className="mt-2 font-mono text-[10px] text-zinc-600">Ref {error.digest}</p>}
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-4 min-h-11 rounded-xl bg-[#bfff3a] px-5 text-sm font-semibold text-black transition-colors hover:bg-[#bfff3a]/80"
      >
        Try again
      </button>
    </div>
  );
}
