import type { Metadata } from "next";
import Script from "next/script";
import "../_styles/about.css";

export const metadata: Metadata = {
    title: "About Mindelo | Custom Software Studio in Trinidad & Tobago",
    description: "Mindelo is a custom software studio in Trinidad and Tobago, founded by Zane Adams and Michael Taylor Walker. We solve business problems with software.",
    alternates: {
      canonical: "/about",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "About Mindelo | Custom Software Studio in Trinidad & Tobago",
      description: "A custom software studio in Trinidad and Tobago, founded by Zane Adams and Michael Taylor Walker. We build software that solves real business problems.",
      url: "https://mindelo.site/about",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "About Mindelo | Custom Software Studio in Trinidad & Tobago",
      description: "A custom software studio in Trinidad and Tobago, founded by Zane Adams and Michael Taylor Walker.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": ["ProfessionalService", "Organization"],
          "@id": "https://mindelo.site/#business",
          "name": "Mindelo",
          "alternateName": "Mindelo Solutions",
          "url": "https://mindelo.site/",
          "image": "https://mindelo.site/assets/img/og-image.jpg",
          "logo": "https://mindelo.site/favicon-96x96.png",
          "knowsAbout": ["custom software development", "custom software solutions", "business dashboards", "API integrations", "internal business tools", "customer-facing web apps", "workflow automation", "software company Trinidad and Tobago"],
          "slogan": "Custom software solutions for Trinidad and Tobago and the Caribbean",
          "description": "Mindelo is a custom software studio based in Trinidad and Tobago, founded by Zane Adams and Michael Taylor Walker. If a business has a problem software can solve, we build it.",
          "email": "admin@mindelo.site",
          "telephone": "+18683612254",
          "priceRange": "$$",
          "founder": [
            { "@type": "Person", "name": "Zane Adams", "sameAs": ["https://www.linkedin.com/in/zane-adams-380630277/"] },
            { "@type": "Person", "name": "Michael Taylor Walker", "sameAs": ["https://www.linkedin.com/in/michael-taylor-walker-3b64a73b9/"] }
          ],
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "19 Stanmore Avenue",
            "addressLocality": "Port of Spain",
            "addressCountry": "TT"
          },
          "areaServed": [
            { "@type": "Country", "name": "Trinidad and Tobago" },
            { "@type": "Place", "name": "Caribbean" }
          ],
          "sameAs": [
            "https://www.instagram.com/mindelo_solutions/",
            "https://www.facebook.com/profile.php?id=61579117153959"
          ]
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://mindelo.site/" },
            { "@type": "ListItem", "position": 2, "name": "About", "item": "https://mindelo.site/about" }
          ]
        }
      ]
    }
    ` }} />
      
    {/* ===== NAVIGATION ===== */}
    <nav className="fixed top-0 w-full z-50 glass-nav h-20 flex items-center px-6 md:px-12 justify-between">
        <a href="/" className="flex items-center gap-3">
            <div className="pulsing-dot"></div>
            <span className="text-2xl font-extrabold tracking-tighter">Mindelo</span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex gap-8 text-sm font-medium text-gray-400">
            <a href="/" className="nav-link hover:text-white">Home</a>
            <a href="/services" className="nav-link hover:text-white">Services</a>
            <a href="/portfolio" className="nav-link hover:text-white">Portfolio</a>
            <a href="/demo" className="nav-link hover:text-white">Demo</a>
            <a href="/voice-receptionist" className="nav-link hover:text-white">Voice</a>
            <a href="/about" className="nav-link hover:text-white">About</a>
            <a href="/contact" className="nav-link hover:text-white">Contact</a>
        </div>

        <div className="flex items-center gap-4">
            <a href="/contact" className="bg-[#00e5b0] text-black px-6 py-2 rounded-full font-bold text-sm hover:scale-105 transition">Contact Us</a>
            {/* Hamburger */}
            <button id="hamburger" className="md:hidden flex flex-col gap-1.5 p-2" aria-label="Open menu">
                <span className="block w-6 h-0.5 bg-white transition-all duration-300" id="hb1"></span>
                <span className="block w-6 h-0.5 bg-white transition-all duration-300" id="hb2"></span>
                <span className="block w-4 h-0.5 bg-white transition-all duration-300" id="hb3"></span>
            </button>
        </div>
    </nav>

    {/* Mobile Menu Drawer */}
    <div id="mobile-menu" className="fixed top-20 left-0 w-full z-40 flex-col bg-[#0c1018] border-b border-gray-800 py-6 px-8 gap-5 text-base font-semibold text-gray-300">
        <a href="/" className="mobile-link hover:text-white transition">Home</a>
        <a href="/services" className="mobile-link hover:text-white transition">Services</a>
        <a href="/portfolio" className="mobile-link hover:text-white transition">Portfolio</a>
        <a href="/demo" className="mobile-link hover:text-white transition">Demo</a>
        <a href="/voice-receptionist" className="mobile-link hover:text-white transition">Voice</a>
        <a href="/about" className="mobile-link hover:text-white transition">About</a>
        <a href="/contact" className="mobile-link hover:text-white transition">Contact</a>
    </div>
    {/* ===== ABOUT ===== */}
    <section id="about" className="py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="reveal">
                <span className="text-[#8b5cf6] text-sm font-bold uppercase tracking-widest">Who we are</span>
                <h1 className="text-3xl md:text-5xl heading-heavy mt-2 mb-6">A Custom Software Studio<br /><span className="text-[#8b5cf6]">in Trinidad and Tobago.</span></h1>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                    Mindelo is a custom software studio based in Trinidad and Tobago, founded by Zane Adams and Michael Taylor Walker. We build software that solves real business problems. It is that simple.
                </p>
                <p className="text-gray-400 text-lg leading-relaxed mb-6">
                    We are a boutique studio, not an agency with account managers and hand-offs. You work directly with the specialist who builds your system, whether that is a dashboard, an internal tool, an integration, or a customer-facing app.
                </p>
                <p className="text-gray-500 leading-relaxed mb-8">
                    Every system is custom-built for your workflows, your tools, and your team. No generic templates. No recurring retainers for things that should run themselves. Just custom software that works, built for how businesses in Trinidad and Tobago and the wider Caribbean actually operate.
                </p>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                        <div className="w-5 h-5 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center text-[#8b5cf6] font-bold text-xs"><span className="about-check-icon" aria-hidden="true"></span></div>
                        Direct access to your builder, always
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                        <div className="w-5 h-5 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center text-[#8b5cf6] font-bold text-xs"><span className="about-check-icon" aria-hidden="true"></span></div>
                        Built for your stack, not a one-size-fits-all template
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                        <div className="w-5 h-5 rounded-full bg-[#8b5cf6]/20 flex items-center justify-center text-[#8b5cf6] font-bold text-xs"><span className="about-check-icon" aria-hidden="true"></span></div>
                        Ongoing support and iteration post-launch
                    </div>
                </div>
            </div>

            <div className="reveal delay-200 flex flex-col gap-6">
                <div className="founder-card founder-card-trigger p-8 rounded-3xl cursor-pointer transition hover:border-[#8b5cf6]/40 hover:-translate-y-1" role="button" tabIndex={0} aria-haspopup="dialog" data-name="Michael Taylor Walker" data-linkedin="https://www.linkedin.com/in/michael-taylor-walker-3b64a73b9/" data-role="Co-Founder & Software Specialist" data-photo="/assets/img/michael.png" data-quote="I started Mindelo because businesses are still spending hours every week on things the right software could just handle. Most companies are stuck with tools that don't fit how they actually work, and I want to change that.">
                    <div className="flex items-center gap-5 mb-6">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#8b5cf6]/20">
                            <img src="/assets/img/michael.png" alt="Michael Taylor Walker" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <p className="font-black text-lg text-white">Michael Taylor Walker</p>
                            <p className="text-[#8b5cf6] text-xs font-bold uppercase tracking-widest mt-0.5">Co-Founder &amp; Software Specialist</p>
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">
                        "I started Mindelo because businesses are still spending hours every week on things the right software could just handle. Most companies are stuck with tools that don't fit how they actually work, and I want to change that."
                    </p>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b5cf6]/70">Tap to expand</span>
                        <a href="https://www.linkedin.com/in/michael-taylor-walker-3b64a73b9/" target="_blank" rel="noopener noreferrer" className="founder-linkedin inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8b5cf6] hover:text-white transition" aria-label="Michael Taylor Walker on LinkedIn">
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95C20.6 8.75 21 11.1 21 14.2V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21H9z" /></svg>
                            LinkedIn
                        </a>
                    </div>
                </div>
                <div className="founder-card founder-card-trigger p-8 rounded-3xl cursor-pointer transition hover:border-[#8b5cf6]/40 hover:-translate-y-1" role="button" tabIndex={0} aria-haspopup="dialog" data-name="Zane Adams" data-linkedin="https://www.linkedin.com/in/zane-adams-380630277/" data-role="Co-Founder & Software Specialist" data-photo="/assets/img/zane.png" data-photo-class="object-top" data-quote="What I love is the moment a client realizes the busywork is just... gone. When the right software handles the boring stuff, people get to spend their time on the work that actually matters to them, and that never gets old for me.">
                    <div className="flex items-center gap-5 mb-6">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-[#8b5cf6]/20">
                            <img src="/assets/img/zane.png" alt="Zane Adams" className="w-full h-full object-cover object-top" />
                        </div>
                        <div>
                            <p className="font-black text-lg text-white">Zane Adams</p>
                            <p className="text-[#8b5cf6] text-xs font-bold uppercase tracking-widest mt-0.5">Co-Founder &amp; Software Specialist</p>
                        </div>
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed mb-3">
                        "What I love is the moment a client realizes the busywork is just... gone. When the right software handles the boring stuff, people get to spend their time on the work that actually matters to them, and that never gets old for me."
                    </p>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#8b5cf6]/70">Tap to expand</span>
                        <a href="https://www.linkedin.com/in/zane-adams-380630277/" target="_blank" rel="noopener noreferrer" className="founder-linkedin inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8b5cf6] hover:text-white transition" aria-label="Zane Adams on LinkedIn">
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95C20.6 8.75 21 11.1 21 14.2V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21H9z" /></svg>
                            LinkedIn
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {/* ===== FOUNDER MODAL ===== */}
    <div id="founder-modal" className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="founder-modal-name">
        <div className="modal-panel founder-card rounded-3xl shadow-2xl max-w-full md:max-w-lg w-full mx-4">
            <div className="relative p-8 md:p-10 text-center">
                <button id="founder-modal-close" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-gray-300 hover:text-white hover:bg-black/80 transition" aria-label="Close">
                    <img src="/assets/icons/close-control.png" alt="" className="modal-close-icon" aria-hidden="true" />
                </button>
                <div className="w-40 h-40 md:w-48 md:h-48 mx-auto mb-6 rounded-3xl border border-[#8b5cf6]/20 overflow-hidden">
                    <img id="founder-modal-photo" src="" alt="" className="w-full h-full object-cover" />
                </div>
                <p id="founder-modal-name" className="font-black text-2xl text-white"></p>
                <p id="founder-modal-role" className="text-[#8b5cf6] text-xs font-bold uppercase tracking-widest mt-1 mb-6"></p>
                <p id="founder-modal-quote" className="text-gray-400 text-base leading-relaxed"></p>
                <a id="founder-modal-linkedin" href="#" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-xl border border-[#8b5cf6]/30 text-[#8b5cf6] text-xs font-bold uppercase tracking-widest hover:border-[#8b5cf6] hover:text-white transition">
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95C20.6 8.75 21 11.1 21 14.2V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21H9z" /></svg>
                    <span id="founder-modal-linkedin-label">View LinkedIn</span>
                </a>
            </div>
        </div>
    </div>

    {/* ===== FAQ ===== */}
    <section className="py-32 px-6 md:px-12">
        <div className="max-w-3xl mx-auto">
            <div className="mb-16 reveal text-center">
                <span className="text-[#ff6b35] text-sm font-bold uppercase tracking-widest">Common Questions</span>
                <h2 className="text-3xl md:text-5xl heading-heavy mt-2">FAQ</h2>
            </div>
            <div className="space-y-3 reveal">
                <div className="faq-item bg-[#0c1018] border border-gray-800 rounded-2xl overflow-hidden">
                    <button className="faq-trigger w-full flex items-center justify-between px-7 py-5 text-left">
                        <span className="font-semibold text-base">How long does implementation take?</span>
                        <span className="faq-icon text-gray-500 text-xl font-light ml-4 flex-shrink-0">+</span>
                    </button>
                    <div className="faq-answer px-7">
                        <p className="text-gray-400 text-sm leading-relaxed pb-5">Most projects are live within 1–3 weeks depending on complexity. A simple website or lead capture automation can be ready in 5–7 days. Larger systems with multiple integrations typically take 2–4 weeks with a phased rollout.</p>
                    </div>
                </div>
                <div className="faq-item bg-[#0c1018] border border-gray-800 rounded-2xl overflow-hidden">
                    <button className="faq-trigger w-full flex items-center justify-between px-7 py-5 text-left">
                        <span className="font-semibold text-base">What platforms do you integrate with?</span>
                        <span className="faq-icon text-gray-500 text-xl font-light ml-4 flex-shrink-0">+</span>
                    </button>
                    <div className="faq-answer px-7">
                        <p className="text-gray-400 text-sm leading-relaxed pb-5">We integrate with virtually any platform that has an API, including GoHighLevel, HubSpot, Salesforce, Notion, Airtable, Slack, Google Workspace, Shopify, and many more. If it has a webhook or API, we can connect it.</p>
                    </div>
                </div>
                <div className="faq-item bg-[#0c1018] border border-gray-800 rounded-2xl overflow-hidden">
                    <button className="faq-trigger w-full flex items-center justify-between px-7 py-5 text-left">
                        <span className="font-semibold text-base">Do I need technical knowledge to use the systems you build?</span>
                        <span className="faq-icon text-gray-500 text-xl font-light ml-4 flex-shrink-0">+</span>
                    </button>
                    <div className="faq-answer px-7">
                        <p className="text-gray-400 text-sm leading-relaxed pb-5">No. Every system is built to run on its own with minimal maintenance. You'll get a handover walkthrough, documentation, and ongoing support. If something breaks or needs updating, just reach out.</p>
                    </div>
                </div>
                <div className="faq-item bg-[#0c1018] border border-gray-800 rounded-2xl overflow-hidden">
                    <button className="faq-trigger w-full flex items-center justify-between px-7 py-5 text-left">
                        <span className="font-semibold text-base">How much does it cost?</span>
                        <span className="faq-icon text-gray-500 text-xl font-light ml-4 flex-shrink-0">+</span>
                    </button>
                    <div className="faq-answer px-7">
                        <p className="text-gray-400 text-sm leading-relaxed pb-5">Pricing depends on scope. Simple automations start from a one-time project fee, while larger custom software builds are custom-quoted. Book a free call and we'll give you a clear estimate with no obligation.</p>
                    </div>
                </div>
                <div className="faq-item bg-[#0c1018] border border-gray-800 rounded-2xl overflow-hidden">
                    <button className="faq-trigger w-full flex items-center justify-between px-7 py-5 text-left">
                        <span className="font-semibold text-base">What happens after launch?</span>
                        <span className="faq-icon text-gray-500 text-xl font-light ml-4 flex-shrink-0">+</span>
                    </button>
                    <div className="faq-answer px-7">
                        <p className="text-gray-400 text-sm leading-relaxed pb-5">We include a post-launch monitoring period to catch any edge cases. After that, we offer optional maintenance packages or can hand the system fully over to you. Either way, you're not left in the dark.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>
    {/* ===== FOOTER ===== */}
    <footer className="py-10 border-t border-gray-800 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
                <div className="pulsing-dot"></div>
                <span className="font-extrabold tracking-tighter text-lg">Mindelo</span>
            </div>
            <p className="text-[10px] text-gray-600 font-bold uppercase">© 2026 Mindelo. Built in Trinidad.</p>
            <div className="flex items-center gap-3">
                <a href="https://www.linkedin.com/in/michael-taylor-walker-3b64a73b9/" target="_blank" rel="noopener noreferrer" aria-label="Michael Taylor Walker on LinkedIn" title="Michael Taylor Walker on LinkedIn" className="social-btn social-btn-linkedin relative flex items-center justify-center w-9 h-9 rounded-lg bg-[#0c1018] border border-gray-800 text-gray-500">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95C20.6 8.75 21 11.1 21 14.2V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21H9z" /></svg>
                    <span className="social-btn-initials" aria-hidden="true">MTW</span>
                </a>
                <a href="https://www.linkedin.com/in/zane-adams-380630277/" target="_blank" rel="noopener noreferrer" aria-label="Zane Adams on LinkedIn" title="Zane Adams on LinkedIn" className="social-btn social-btn-linkedin relative flex items-center justify-center w-9 h-9 rounded-lg bg-[#0c1018] border border-gray-800 text-gray-500">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95C20.6 8.75 21 11.1 21 14.2V21h-4v-6c0-1.43-.03-3.27-2-3.27-2 0-2.3 1.56-2.3 3.17V21H9z" /></svg>
                    <span className="social-btn-initials" aria-hidden="true">ZA</span>
                </a>
                <a href="https://www.instagram.com/mindelo_solutions/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="social-btn social-btn-instagram flex items-center justify-center w-9 h-9 rounded-lg bg-[#0c1018] border border-gray-800 text-gray-500">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width={20} height={20} rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                </a>
                <a href="https://www.facebook.com/profile.php?id=61579117153959" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="social-btn social-btn-facebook flex items-center justify-center w-9 h-9 rounded-lg bg-[#0c1018] border border-gray-800 text-gray-500">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                </a>
            </div>
        </div>
    </footer>
    <Script id="about-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
        // --- REVEAL ON SCROLL ---
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('active');
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

        // --- MOBILE HAMBURGER MENU ---
        const hamburger = document.getElementById('hamburger');
        const mobileMenu = document.getElementById('mobile-menu');
        const hb1 = document.getElementById('hb1');
        const hb2 = document.getElementById('hb2');
        const hb3 = document.getElementById('hb3');
        let menuOpen = false;

        hamburger.addEventListener('click', () => {
            menuOpen = !menuOpen;
            mobileMenu.classList.toggle('open', menuOpen);
            hb1.style.transform = menuOpen ? 'translateY(8px) rotate(45deg)' : '';
            hb2.style.opacity = menuOpen ? '0' : '1';
            hb3.style.transform = menuOpen ? 'translateY(-8px) rotate(-45deg)' : '';
            hb3.style.width = menuOpen ? '24px' : '';
        });

        document.querySelectorAll('.mobile-link').forEach(link => {
            link.addEventListener('click', () => {
                menuOpen = false;
                mobileMenu.classList.remove('open');
                hb1.style.transform = '';
                hb2.style.opacity = '1';
                hb3.style.transform = '';
                hb3.style.width = '';
            });
        });

        // --- PAGE EXIT TRANSITION ---
        document.querySelectorAll('a[href]').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (!href || href.startsWith('#') || href.startsWith('http') ||
                    href.startsWith('mailto') || href.startsWith('tel') ||
                    link.type === 'submit' || link.closest('form')) return;
                e.preventDefault();
                document.body.classList.add('page-exit');
                setTimeout(() => { window.location.href = href; }, 300);
            });
        });
    ` }} />
    <Script id="about-1" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
        // --- FAQ ACCORDION ---
        document.querySelectorAll('.faq-trigger').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.closest('.faq-item');
                const answer = item.querySelector('.faq-answer');
                const isOpen = item.classList.contains('open');

                // Close all
                document.querySelectorAll('.faq-item').forEach(i => {
                    i.classList.remove('open');
                    i.querySelector('.faq-answer').classList.remove('open');
                });

                // Open clicked if it was closed
                if (!isOpen) {
                    item.classList.add('open');
                    answer.classList.add('open');
                }
            });
        });
    ` }} />
    <Script id="about-2" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
        // --- FOUNDER MODAL ---
        const founderModal = document.getElementById('founder-modal');
        const founderPhoto = document.getElementById('founder-modal-photo');
        const founderName = document.getElementById('founder-modal-name');
        const founderRole = document.getElementById('founder-modal-role');
        const founderQuote = document.getElementById('founder-modal-quote');
        const founderLinkedin = document.getElementById('founder-modal-linkedin');

        function openFounderModal(card) {
            founderPhoto.src = card.dataset.photo;
            founderPhoto.alt = card.dataset.name;
            founderPhoto.className = 'w-full h-full object-cover ' + (card.dataset.photoClass || '');
            founderName.textContent = card.dataset.name;
            founderRole.innerHTML = card.dataset.role;
            founderQuote.textContent = '“' + card.dataset.quote + '”';
            founderLinkedin.href = card.dataset.linkedin;
            document.getElementById('founder-modal-linkedin-label').textContent = card.dataset.name.split(' ')[0] + ' on LinkedIn';
            founderLinkedin.setAttribute('aria-label', card.dataset.name + ' on LinkedIn');
            founderModal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }

        function closeFounderModal() {
            founderModal.classList.remove('open');
            document.body.style.overflow = '';
        }

        document.querySelectorAll('.founder-linkedin').forEach(link => {
            link.addEventListener('click', e => e.stopPropagation());
            link.addEventListener('keydown', e => e.stopPropagation());
        });

        document.querySelectorAll('.founder-card-trigger').forEach(card => {
            card.addEventListener('click', () => openFounderModal(card));
            card.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFounderModal(card); }
            });
        });

        document.getElementById('founder-modal-close').addEventListener('click', closeFounderModal);
        founderModal.addEventListener('click', e => { if (e.target === founderModal) closeFounderModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFounderModal(); });
    ` }} />
    <Script id="about-3" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `document.querySelector('.nav-link[href="/about"]')?.classList.add('active');` }} />

    </>
  );
}
