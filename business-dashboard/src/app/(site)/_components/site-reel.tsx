import Image from "next/image";
import type { Website } from "../portfolio/websites/_data";

/*
 * Plays each client website in turn inside a browser frame: the homepage
 * scrolls from top to bottom, then fades into the next site, on a loop.
 * CSS only. Visitors who ask for reduced motion see the first site, still.
 * The images are <slug>-full.webp from scripts/capture-websites.mjs.
 */

const SECONDS_PER_SITE = 7;

// The keyframe stops depend on how many sites share one cycle, so the CSS is built here.
function reelCss(count: number): string {
  const share = 100 / count;
  const fade = share / 6;
  const pct = (n: number) => `${n.toFixed(2)}%`;
  return `
.site-reel { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: 0.75rem; border: 1px solid #1f2937; background: #06090d; }
.site-reel-slide { position: absolute; inset: 0; display: flex; flex-direction: column; opacity: 0; animation: site-reel-show var(--reel-cycle) linear infinite; }
.site-reel-bar { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; flex-shrink: 0; background: #0c1018; border-bottom: 1px solid #1f2937; }
.site-reel-bar i { width: 8px; height: 8px; border-radius: 9999px; background: #374151; }
.site-reel-bar span { margin-left: 8px; font-size: 11px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.site-reel-view { position: relative; flex: 1; min-height: 0; }
.site-reel-img { object-fit: cover; object-position: 50% 0%; animation: site-reel-scroll var(--reel-cycle) ease-in-out infinite; }
@keyframes site-reel-show { 0% { opacity: 0; } ${pct(fade)} { opacity: 1; } ${pct(share)} { opacity: 1; } ${pct(share + fade)} { opacity: 0; } 100% { opacity: 0; } }
@keyframes site-reel-scroll { 0%, ${pct(fade * 2)} { object-position: 50% 0%; } ${pct(share - fade)}, 100% { object-position: 50% 100%; } }
.site-reel:hover .site-reel-slide, .site-reel:hover .site-reel-img { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .site-reel-slide, .site-reel-img { animation: none; }
  .site-reel-slide:first-child { opacity: 1; }
}`;
}

export function SiteReel({ sites }: { sites: Website[] }) {
  return (
    <div className="site-reel" aria-hidden="true" style={{ "--reel-cycle": `${SECONDS_PER_SITE * sites.length}s` } as React.CSSProperties}>
      {sites.map((site, i) => {
        const delay = { animationDelay: `${i * SECONDS_PER_SITE}s` };
        return (
          <div key={site.slug} className="site-reel-slide" style={delay}>
            <div className="site-reel-bar">
              <i />
              <i />
              <i />
              <span>{new URL(site.url).hostname.replace(/^www\./, "")}</span>
            </div>
            <div className="site-reel-view">
              <Image src={`/assets/websites/${site.slug}-full.webp`} alt="" fill sizes="(min-width: 768px) 45vw, 90vw" className="site-reel-img" style={delay} />
            </div>
          </div>
        );
      })}
      <style dangerouslySetInnerHTML={{ __html: reelCss(sites.length) }} />
    </div>
  );
}
