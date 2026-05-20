---
description: Scaffold a new client marketing site from a reference pattern, in Taylor's style.
---

# /new-marketing-site

Build a new client marketing site by starting from the closest reference pattern
in the `trinirugby/website-references` library. Designed to be run by a terminal
(Claude Code) that has claimed a `New marketing site` Task queued from the
Automation Launcher (Kind `code`). This is a coding job — it runs in a real
working directory with git, not inside the dashboard web request.

## Inputs

Read from the claimed Task's `Inputs` JSON (or ask if run directly):

- `clientName` — the client / business name (**required**).
- `pattern` — one of `restaurant | realtor | service-business | ecommerce | activity-venue | agency-self`.
- `notes` — anything specific to honor (brand colors, must-have sections, copy).

## Steps

1. **Pull the reference.** Clone or open `trinirugby/website-references` and read
   its `NOTES.md` plus the snapshot matching `pattern`. This is the style source —
   match Taylor's structure, tone, and quality; do not copy a client's content
   verbatim.
2. **Scaffold the new site.** Create a new repo/folder named for the client
   (kebab-case). Start from the reference pattern's layout (hero, services,
   gallery/menu, about, contact), then tailor copy and sections to `clientName`
   and `notes`. Keep it static HTML/CSS/JS unless the notes require otherwise.
3. **Brand it.** Apply sensible colors/typography for the business type; leave
   obvious placeholders (logo, real photos, real copy) clearly marked as TODO.
4. **Verify locally.** Open the site in a browser; check it renders, is
   responsive, and has no broken links/images.
5. **Record it.** Optionally add a Projects row in Airtable (`getProjects` shape:
   `Name`, `Service Type`, `GitHub Repo URL`, `Deploy URL`, `Host`) so the new
   site shows up in the Dev hub.

## Acceptance

- A new client site exists, scaffolded from the chosen reference pattern.
- It renders locally and is responsive, with placeholders clearly flagged.
- No reference client's copy is reused verbatim.
