import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The dashboard is not linked from anywhere public and every route under
      // it also carries `noindex, nofollow` in its own metadata. This is the
      // belt to that pair of braces.
      disallow: ["/admin", "/admin/"],
    },
    sitemap: "https://mindelo.site/sitemap.xml",
  };
}
