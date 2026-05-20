---
description: Re-snapshot the website-references library so new client builds start from current work.
---

# /refresh-references

Refresh the `trinirugby/website-references` library: re-snapshot recently shipped
client sites by pattern and update `NOTES.md`, so `/new-marketing-site` always
starts from current, high-quality references. Designed to be run by a terminal
(Claude Code) that has claimed a `Refresh references` Task queued from the
Automation Launcher (Kind `ops`). This is a coding/git job — it runs in a real
working directory, not inside the dashboard web request.

## Inputs

Read from the claimed Task's `Inputs` JSON (or ask if run directly):

- `notes` — which sites to (re)snapshot and why; leave blank to refresh all.

## Steps

1. **Open the library.** Clone or open `trinirugby/website-references` and read
   `NOTES.md` to see the current patterns and what each snapshot represents.
2. **Identify what changed.** From `notes` (or by checking the live client sites
   listed in the Dev hub / Projects), determine which references are stale.
3. **Re-snapshot.** For each, capture the current build into the matching pattern
   folder (strip client-specific secrets/keys; keep structure + styling). Add a
   new pattern folder if a site doesn't fit an existing one.
4. **Update `NOTES.md`.** Record what each snapshot is, the pattern it represents,
   and the date refreshed.
5. **Commit + push.** Commit with a clear message and push to the references repo.

## Acceptance

- Stale snapshots are refreshed (or new patterns added) under the right folders.
- `NOTES.md` reflects the current set with dates.
- No client secrets/keys are committed; changes are pushed.
