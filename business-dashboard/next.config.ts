import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `postgres` (porsager) uses Node-native net/tls sockets. Next bundles Server
  // Component dependencies by default, which breaks those; `pg` is on Next's
  // built-in opt-out list but `postgres` is not, so it has to be named here.
  serverExternalPackages: ["postgres"],

  async redirects() {
    // The marketing site was ten .html files served from the repo root, and
    // Netlify served both the pretty path and the underlying file with a 200.
    // The pretty paths are now real routes; these keep the .html forms, and any
    // link anyone ever shared, out of a 404.
    const legacy: Record<string, string> = {
      "/index.html": "/",
      "/services.html": "/services",
      "/portfolio.html": "/portfolio",
      "/demo.html": "/demo",
      "/demo-aisl-quote-followup.html": "/demo/aisl-quote-followup",
      "/demo-hyline-job-tracker.html": "/demo/hyline-job-tracker",
      "/voice-receptionist.html": "/voice-receptionist",
      "/about.html": "/about",
      "/contact.html": "/contact",
      "/linktree.html": "/links",
    };
    return Object.entries(legacy).map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
};

export default nextConfig;
