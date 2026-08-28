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
const ROUTES: Array<{ path: string; priority: number }> = [
  { path: "/", priority: 1.0 },
  { path: "/services", priority: 0.9 },
  { path: "/voice-receptionist", priority: 0.9 },
  { path: "/portfolio", priority: 0.8 },
  { path: "/contact", priority: 0.8 },
  { path: "/demo", priority: 0.7 },
  { path: "/demo/aisl-quote-followup", priority: 0.6 },
  { path: "/demo/hyline-job-tracker", priority: 0.6 },
  { path: "/about", priority: 0.7 },
  { path: "/links", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, priority }) => ({
    url: BASE + path,
    lastModified: new Date("2026-08-28"),
    changeFrequency: "monthly" as const,
    priority,
  }));
}
