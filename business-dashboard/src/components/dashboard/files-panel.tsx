"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { deleteFileAction, finishUploadAction, startUploadAction } from "@/app/documents-actions";
import { FILE_KINDS, FILE_KIND_LABEL, type Attachable, type FileKind } from "@/lib/documents";
import type { Attachment } from "@/lib/documents-db";
import { selectCls } from "@/components/dashboard/clients-list";

// The anon key is public by design; the one-time signed upload token is what authorises the upload.
const browserStorage = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    .storage.from("files");

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Files attached to one record: open, add (including from a phone camera), remove. */
export function FilesPanel({
  entityType, entityId, files, defaultKind = "other", title = "Files",
  note = "Signed copies, proof of payment and anything else for this record. Private to admins.",
}: {
  entityType: Attachable; entityId: string; files: Attachment[]; defaultKind?: FileKind; title?: string; note?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>(defaultKind);
  const [busy, start] = useTransition();

  async function upload(file: File): Promise<void> {
    const type = file.type || "application/octet-stream";
    try {
      const begun = await startUploadAction({ entityType, entityId, size: file.size });
      if (!begun.ok) {
        toast.error(begun.error);
        return;
      }
      // Re-type the blob: upload() ignores contentType for a File whose own type is empty.
      const { error } = await browserStorage().uploadToSignedUrl(begun.data.path, begun.data.token, file.slice(0, file.size, type), { contentType: type });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }
      const done = await finishUploadAction({ entityType, entityId, path: begun.data.path, filename: file.name, contentType: type, size: file.size, kind });
      if (!done.ok) {
        toast.error(done.error);
        return;
      }
      toast.success(`${file.name} attached`);
    } catch (e) {
      console.error(e);
      toast.error("Upload failed. Check your connection and try again.");
    }
  }

  const remove = (f: Attachment) => {
    if (!confirm(`Remove ${f.filename}? This deletes the file.`)) return;
    start(async () => {
      const r = await deleteFileAction(f.id);
      if (r.ok) toast.success("Removed");
      else toast.error(r.error);
    });
  };

  return (
    <section className="border border-[#DCE1E8] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1B2533]">{title}</h2>
          <p className="mt-0.5 text-xs text-[#4A5568]">{note}</p>
        </div>
        <div className="flex gap-2">
          <select aria-label="Kind of file" value={kind} onChange={(e) => setKind(e.target.value as FileKind)}
            className={`${selectCls} min-h-11 w-auto text-xs sm:min-h-0`}>
            {FILE_KINDS.map((k) => <option key={k} value={k}>{FILE_KIND_LABEL[k]}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="min-h-11 sm:min-h-0 rounded-[4px] bg-[#1D4ED8] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8]/80 disabled:opacity-40">
            {busy ? "Working…" : "+ Attach file"}
          </button>
          <input ref={input} type="file" className="hidden" accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.csv,.txt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) start(() => upload(f));
            }} />
        </div>
      </div>
      {files.length === 0 ? (
        <p className="mt-3 text-sm text-[#6B7789]">No files yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EEF1F5] text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <a href={`/admin/files/${f.id}`} target="_blank" rel="noopener" className="min-h-11 sm:min-h-0 text-left font-medium text-[#1D4ED8] hover:underline">
                {f.filename}
              </a>
              <span className="flex items-center gap-3 text-xs text-[#5A6678]">
                {FILE_KIND_LABEL[f.kind]} · {kb(f.size)} · {f.created.slice(0, 10)}
                <button type="button" disabled={busy} onClick={() => remove(f)} className="min-h-11 sm:min-h-0 text-[#B23A0A] hover:underline disabled:opacity-40">Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
