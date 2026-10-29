import type { Metadata } from "next";
import Image from "next/image";
import "../../_styles/portfolio.css";
import { SiteChrome } from "../../_components/site-chrome";
import { toJsonLd } from "../../_components/json-ld";
import { websites } from "./_data";

const PAGE_URL = "https://mindelo.site/portfolio/websites";
const OG_IMAGE = "https://mindelo.site/assets/img/og-image.jpg";
const TITLE = "Websites We've Built | Mindelo Trinidad & Tobago";
const DESCRIPTION =
  "Live websites Mindelo designed and built for Trinidad and Tobago businesses in retail, real estate, marine, marketing, and recruitment.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/portfolio/websites" },
  openGraph: {
    type: "website",
    siteName: "Mindelo",
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    locale: "en_TT",
    images: [{ url: OG_IMAGE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://mindelo.site/#business",
      name: "Mindelo",
      url: "https://mindelo.site/",
    },
    {
      "@type": "CollectionPage",
      "@id": `${PAGE_URL}#page`,
      url: PAGE_URL,
      name: TITLE,
      description: DESCRIPTION,
      publisher: { "@id": "https://mindelo.site/#business" },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: websites.map((site, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "WebSite",
            name: site.client,
            url: site.url,
            creator: { "@id": "https://mindelo.site/#business" },
          },
        })),
      },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://mindelo.site/" },
        { "@type": "ListItem", position: 2, name: "Portfolio", item: "https://mindelo.site/portfolio" },
        { "@type": "ListItem", position: 3, name: "Websites", item: PAGE_URL },
      ],
    },
  ],
};

export default function WebsitesPage() {
  return (
    <SiteChrome active="/portfolio">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }} />
      <main className="pt-36 pb-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <header className="mb-16 reveal">
            <a href="/portfolio" className="text-gray-500 text-xs font-bold uppercase tracking-widest hover:text-white transition">&larr; Portfolio</a>
            <span className="block mt-8 text-[#3b9eff] text-sm font-bold uppercase tracking-widest">Our Work</span>
            <h1 className="text-4xl md:text-6xl heading-heavy mt-2">Websites we&apos;ve built</h1>
            <p className="text-gray-400 mt-4 max-w-2xl">
              Every site on this page is live and was built for a business in Trinidad and Tobago. Open any one to see it working.
            </p>
          </header>

          <div className="grid md:grid-cols-2 gap-8">
            {websites.map((site, i) => (
              <a
                key={site.slug}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`portfolio-card reveal group block delay-${(i % 2) * 100 + 100}`}
                style={{ "--card-accent": "#00e5b0" } as React.CSSProperties}
              >
                <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500 h-full">
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-gray-800">
                    <Image
                      src={site.image}
                      alt={`${site.client} website homepage`}
                      width={1200}
                      height={750}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                    />
                  </div>
                  <div className="p-8">
                    <span className="text-[#00e5b0] text-[10px] font-bold uppercase tracking-widest">{site.industry}</span>
                    <h2 className="text-xl font-bold mt-1 mb-3">{site.client}</h2>
                    <p className="text-gray-400 text-sm">{site.built}</p>
                    <span className="inline-flex items-center gap-1.5 mt-5 text-[#00e5b0] text-xs font-bold uppercase tracking-widest group-hover:opacity-70 transition-opacity">
                      {new URL(site.url).hostname.replace(/^www\./, "")}
                      <span aria-hidden="true">↗</span>
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <section className="mt-24 text-center reveal">
            <h2 className="text-3xl md:text-4xl heading-heavy">Want a site that does more than sit there?</h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              Tell us what your website should do for your business. We&apos;ll show you what it takes in a free 30-minute consult.
            </p>
            <a href="/contact" className="inline-block mt-8 bg-[#00e5b0] text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition">
              Book a free consult
            </a>
          </section>
        </div>
      </main>
    </SiteChrome>
  );
}
