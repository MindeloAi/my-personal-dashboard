import type { MetadataRoute } from "next";

const BASE = "https://mindelo.site";

// Every public marketing route. /admin and its children are deliberately absent,
// as are /login and /intake.
//
// NOTE: the two /demo/* pages still carry `noindex` in their own metadata,
// inherited from the pages as they stand on Netlify today. Listing a noindex
// page in a sitemap is a contradictory signal to a crawler. They are listed
// here because the port brief asked for them; the `noindex` is left as it was
// found because changing it is a content decision, not a migration one. Resolve
// one way or the other before this sitemap is submitted anywhere.
//
// lastModified is the date the page's content last changed, not the date of
// its last commit: a nav or footer link is not a content change.
const ROUTES: Array<{ path: string; priority: number; lastModified: string }> = [
  { path: "/", priority: 1.0, lastModified: "2026-08-28" },
  { path: "/services", priority: 0.9, lastModified: "2026-08-28" },
  { path: "/voice-receptionist", priority: 0.9, lastModified: "2026-08-28" },
  { path: "/portfolio", priority: 0.8, lastModified: "2026-08-28" },
  { path: "/websites", priority: 0.8, lastModified: "2026-10-06" },
  { path: "/contact", priority: 0.8, lastModified: "2026-08-28" },
  { path: "/demo", priority: 0.7, lastModified: "2026-08-28" },
  { path: "/demo/aisl-quote-followup", priority: 0.6, lastModified: "2026-08-28" },
  { path: "/demo/hyline-job-tracker", priority: 0.6, lastModified: "2026-08-28" },
  { path: "/about", priority: 0.7, lastModified: "2026-08-28" },
  { path: "/links", priority: 0.5, lastModified: "2026-09-21" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, priority, lastModified }) => ({
    url: BASE + path,
    lastModified: new Date(lastModified),
    changeFrequency: "monthly" as const,
    priority,
  }));
}
