import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./_styles/icons.css";

// The marketing pages used a Google Fonts <link>. Serving the face from the app
// removes the render-blocking third-party request. The generated family name is
// hashed, so the ported stylesheets refer to the variable rather than the name.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  // Lets each page declare `alternates.canonical` as a path, so the same tree
  // renders correct absolute URLs on a preview deployment and on the domain.
  metadataBase: new URL("https://mindelo.site"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

/**
 * Wrapper for every public marketing route.
 *
 * `.site-root` is load-bearing, not decoration. The site's stylesheets set
 * `body { background }` and a font-family, and the dashboard shares the same
 * <body>. Every ported rule is confined to this subtree, and the handful of
 * genuinely body-level rules are scoped as `body:has(.site-root)`, which keeps
 * them in agreement with the page-transition script that toggles classes on
 * document.body itself.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`site-root ${jakarta.variable}`}>{children}</div>;
}
