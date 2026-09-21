import type { Metadata } from "next";
import Script from "next/script";
import "../_styles/links.css";

export const metadata: Metadata = {
    title: "Mindelo | Links",
    description: "All of Mindelo's links in one place: book a call, visit our site, and connect with us. Custom software solutions in Trinidad and Tobago.",
    alternates: {
      canonical: "/links",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "Mindelo | Links",
      description: "All of Mindelo's links in one place: book a call, visit our site, and connect with us.",
      url: "https://mindelo.site/links",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Mindelo | Links",
      description: "All of Mindelo's links in one place.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function LinksPage() {
  return (
    <>
      
      
    <main className="relative z-10 mx-auto w-full max-w-[440px] px-5 py-12 sm:py-16 flex flex-col items-center">

        {/* ===== HEADER ===== */}
        <div className="reveal flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl border border-[#00e5b0]/25 bg-[#0c1018] flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(0,229,176,0.12)]">
                <svg width={34} height={34} viewBox="0 0 64 64" aria-hidden="true">
                    <path d="M14 46 V18 h6 l12 16 12-16 h6 V46 h-7 V30 l-9 12 h-4 l-9-12 V46 Z" fill="#00e5b0" />
                </svg>
            </div>
            <div className="flex items-center gap-2.5 mb-2">
                <span className="pulsing-dot"></span>
                <h1 className="text-3xl heading-heavy">Mindelo</h1>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-[300px]">Custom software for Trinidad &amp; Tobago businesses.</p>
        </div>

        {/* ===== LINKS ===== */}
        <nav className="w-full mt-10 space-y-3.5">

            {/* Book a call (primary) */}
            <a href="/contact" className="link-btn link-primary reveal d1 flex items-center gap-4 w-full bg-[#00e5b0] text-black rounded-2xl px-5 py-4 font-bold shadow-[0_0_20px_rgba(0,229,176,0.18)]">
                <span className="w-10 h-10 rounded-xl bg-black/10 flex items-center justify-center shrink-0">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width={18} height={18} rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                </span>
                <span className="flex-1">Book a call</span>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><polyline points="9 18 15 12 9 6" /></svg>
            </a>

            {/* Intake form */}
            <a href="https://form.jotform.com/261895364766070" target="_blank" rel="noopener noreferrer" className="link-btn link-secondary link-form reveal d2 flex items-center gap-4 w-full rounded-2xl px-5 py-4 font-semibold text-white">
                <span className="w-10 h-10 rounded-xl bg-[#8b5cf6]/12 flex items-center justify-center text-[#8b5cf6] shrink-0">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width={8} height={4} rx="1" /><path d="M9 12h6" /><path d="M9 16h4" /></svg>
                </span>
                <span className="flex-1">Tell us about your operation</span>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><polyline points="9 18 15 12 9 6" /></svg>
            </a>

            {/* Visit website */}
            <a href="/" className="link-btn link-secondary reveal d3 flex items-center gap-4 w-full rounded-2xl px-5 py-4 font-semibold text-white">
                <span className="w-10 h-10 rounded-xl bg-[#3b9eff]/12 flex items-center justify-center text-[#3b9eff] shrink-0">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                </span>
                <span className="flex-1">Visit our website</span>
                <span className="text-gray-500 text-xs font-medium">mindelo.site</span>
            </a>

            {/* Instagram */}
            <a href="https://www.instagram.com/mindelo_solutions/" target="_blank" rel="noopener noreferrer" className="link-btn link-secondary link-instagram reveal d4 flex items-center gap-4 w-full rounded-2xl px-5 py-4 font-semibold text-white">
                <span className="w-10 h-10 rounded-xl bg-[#e1306c]/12 flex items-center justify-center text-[#e1306c] shrink-0">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width={20} height={20} rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                </span>
                <span className="flex-1">Mindelo</span>
                <span className="text-gray-500 text-xs font-medium">@mindelo_solutions</span>
            </a>

            {/* CariPromos */}
            <a href="https://caripromos.com" target="_blank" rel="noopener noreferrer" className="link-btn link-secondary reveal d5 flex items-center gap-4 w-full rounded-2xl px-5 py-4 font-semibold text-white">
                <span className="w-10 h-10 rounded-xl bg-[#f59e0b]/12 flex items-center justify-center text-[#f59e0b] shrink-0">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                </span>
                <span className="flex-1">CariPromos</span>
                <span className="text-gray-500 text-xs font-medium">caripromos.com</span>
            </a>

            {/* Email */}
            <a href="mailto:admin@mindelo.site" className="link-btn link-secondary reveal d5 flex items-center gap-4 w-full rounded-2xl px-5 py-4 font-semibold text-white">
                <span className="w-10 h-10 rounded-xl bg-[#00e5b0]/12 flex items-center justify-center text-[#00e5b0] shrink-0">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width={20} height={16} rx="2" /><path d="m22 7-10 5L2 7" /></svg>
                </span>
                <span className="flex-1">Email us</span>
                <span className="text-gray-500 text-xs font-medium">admin@mindelo.site</span>
            </a>
        </nav>

        {/* ===== SCAN / SHARE ===== */}
        <div className="reveal d6 w-full mt-10">
            <div className="relative bg-[#0c1018] rounded-3xl border border-gray-800 p-6 flex flex-col items-center text-center overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00e5b0] via-[#3b9eff] to-[#8b5cf6]"></div>
                <p className="text-[11px] tracking-[0.18em] uppercase font-bold text-gray-500 mb-4">Scan to share</p>
                <div className="bg-white rounded-2xl p-3 shadow-lg">
                    <img src="/assets/qr/mindelo-links.svg" alt="QR code linking to mindelo.site/links" width={180} height={180} className="block w-[180px] h-[180px]" />
                </div>
                <button id="copy-link" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gray-300 bg-black/30 border border-gray-800 rounded-full px-4 py-2 hover:border-[#00e5b0]/40 hover:text-white transition">
                    <svg id="copy-icon" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width={13} height={13} rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    <span id="copy-label">Copy link</span>
                </button>
            </div>
        </div>

        {/* ===== FOOTER ===== */}
        <footer className="reveal d7 mt-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
                <span className="pulsing-dot"></span>
                <span className="font-extrabold tracking-tighter text-sm">Mindelo</span>
            </div>
            <p className="text-[10px] text-gray-600 font-bold uppercase">© 2026 Mindelo. Built for the future.</p>
        </footer>
    </main>

    <Script id="links-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
        // Reveal on load (elements are above the fold, so trigger shortly after paint)
        (function (f) { f(); })(() => {
            requestAnimationFrame(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('active')));
        });

        // Copy link to clipboard
        const copyBtn = document.getElementById('copy-link');
        const copyLabel = document.getElementById('copy-label');
        copyBtn.addEventListener('click', async () => {
            const url = 'https://mindelo.site/links';
            try {
                await navigator.clipboard.writeText(url);
                copyLabel.textContent = 'Copied!';
                copyBtn.classList.add('text-[#00e5b0]');
                setTimeout(() => { copyLabel.textContent = 'Copy link'; copyBtn.classList.remove('text-[#00e5b0]'); }, 1800);
            } catch {
                copyLabel.textContent = url;
            }
        });
    ` }} />

    </>
  );
}
