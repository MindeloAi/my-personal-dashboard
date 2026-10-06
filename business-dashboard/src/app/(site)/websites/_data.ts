// Live websites Mindelo built for paying clients, shown on /websites.
// Only paying clients with a live site belong here. Run
// `npm run test:content` after any edit, and `node scripts/capture-websites.mjs`
// after adding a site.
//
// Add a site only after Zane confirms the client is paying and agrees to be listed.

export type Website = {
  slug: string; // Screenshot file name and React key
  client: string;
  industry: string;
  url: string; // Live URL
  built: string; // One sentence: what Mindelo built
  image: string; // "/assets/websites/<slug>.webp"
};

export const websites: Website[] = [
  {
    slug: "retro-closet",
    client: "Retro Closet",
    industry: "Retail",
    url: "https://retrocloset.org",
    built: "An online jersey store with a full product catalogue, a shopping cart, and a storefront that matches the brand.",
    image: "/assets/websites/retro-closet.webp",
  },
  {
    slug: "decle-realty",
    client: "Decle Realty",
    industry: "Real estate",
    url: "https://declerealty.net",
    built: "A real estate site with property listings and agent contact details, built to show available homes to buyers and renters.",
    image: "/assets/websites/decle-realty.webp",
  },
  {
    slug: "goodwood-marine",
    client: "Goodwood Marine",
    industry: "Marine electronics",
    url: "https://goodwoodmarine.com",
    built: "A site for a marine electronics dealer in Chaguaramas, covering sales, installation, and repair.",
    image: "/assets/websites/goodwood-marine.webp",
  },
  {
    slug: "vantage-media",
    client: "Vantage Media Marketing",
    industry: "Marketing agency",
    url: "https://vantagemediatt.com",
    built: "A marketing site for a Trinidad social media agency.",
    image: "/assets/websites/vantage-media.webp",
  },
  {
    slug: "adams-recruitment",
    client: "Adams Recruitment",
    industry: "Recruitment",
    url: "https://adams-recruitment.netlify.app",
    built: "A new site for a rebranded recruitment firm, with separate paths for employers and job seekers.",
    image: "/assets/websites/adams-recruitment.webp",
  },
  {
    slug: "trinity-property",
    client: "Trinity Property Solutions",
    industry: "Real estate and property management",
    url: "https://trinity-property-solutions.vercel.app",
    built: "A site for a Trinidad and Tobago real estate and property management firm.",
    image: "/assets/websites/trinity-property.webp",
  },
];
