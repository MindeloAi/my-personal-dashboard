// Private file storage (bucket `files`, migration 023). Server only: it uses
// the service role key, which must never reach the browser. The browser gets a
// one-time signed upload URL and short-lived signed download URLs, so files
// never pass through a Vercel function (which caps request bodies).
// Only import this from server actions or server components (`server-only` is
// not installed; the env var has no NEXT_PUBLIC_ prefix, so a client bundle
// would get no key anyway).
import { createClient } from "@supabase/supabase-js";

const BUCKET = "files";
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("File storage is not configured (SUPABASE_SERVICE_ROLE_KEY missing)");
  return createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);
}

/** A one-time URL the browser uploads one file to. The key holds no user text. */
export async function signedUpload(path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await storage().createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Could not start the upload: ${error?.message ?? "no URL"}`);
  return { path: data.path, token: data.token };
}

/** A link to one file, valid for five minutes, that downloads it under its real name. */
export async function signedDownload(path: string, filename: string): Promise<string> {
  const { data, error } = await storage().createSignedUrl(path, 300, { download: filename });
  if (error || !data) throw new Error(`Could not open the file: ${error?.message ?? "no URL"}`);
  return data.signedUrl;
}

/** Confirms the upload really landed before its record is written. */
export async function exists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const name = path.slice(slash + 1);
  const { data, error } = await storage().list(path.slice(0, slash), { search: name });
  if (error) throw new Error(`Could not check the upload: ${error.message}`);
  return data.some((o) => o.name === name);
}

export async function removeFile(path: string): Promise<void> {
  const { error } = await storage().remove([path]);
  if (error) throw new Error(`Could not delete the file: ${error.message}`);
}

/** Server-side upload (PDFs we render). Never overwrites: a frozen version's file is written once. */
export async function uploadBytes(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { error } = await storage().upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Could not store the file: ${error.message}`);
}
