// The data layer moved to Postgres (Supabase). See ./db.ts.
//
// This module stays as a re-export so the 24 files importing "@/lib/airtable"
// did not have to change during the migration — `export *` preserves class
// identity, so `err instanceof MissingAirtableEnvError` still works.
//
// Pass 2 rewrites the import specifiers to "@/lib/db" and deletes this file.
export * from "./db";
