"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { disconnectClaudeAction } from "./actions";

export function DisconnectButton() {
  const [busy, start] = useTransition();
  const disconnect = () => {
    if (!window.confirm("Disconnect Claude? Every Claude app you connected stops working until you connect it again.")) return;
    start(async () => {
      const r = await disconnectClaudeAction();
      if (r.ok) toast.success(r.revoked ? "Claude disconnected" : "Nothing was connected");
      else toast.error(r.error);
    });
  };
  return (
    <button type="button" onClick={disconnect} disabled={busy}
      className="min-h-11 sm:min-h-0 rounded-[4px] border border-[#B23A0A] px-3 py-2 text-xs font-semibold text-[#B23A0A] hover:bg-[#B23A0A]/5 disabled:opacity-50">
      {busy ? "Disconnecting" : "Disconnect Claude"}
    </button>
  );
}
