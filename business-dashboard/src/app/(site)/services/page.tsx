import type { Metadata } from "next";
import Script from "next/script";
import "../_styles/services.css";

export const metadata: Metadata = {
    title: "Custom Software Solutions in Trinidad & Tobago | Mindelo",
    description: "Custom software for Trinidad and Tobago businesses: dashboards, internal tools, integrations, automations, and apps. If software can solve it, we build it.",
    alternates: {
      canonical: "/services",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "Custom Software Solutions in Trinidad & Tobago | Mindelo",
      description: "Custom software built for Trinidad and Tobago businesses: dashboards, internal tools, integrations, automations, and customer-facing apps.",
      url: "https://mindelo.site/services",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Custom Software Solutions in Trinidad & Tobago | Mindelo",
      description: "Custom software for Trinidad and Tobago businesses: dashboards, internal tools, integrations, and customer-facing apps.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function ServicesPage() {
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
          "description": "Mindelo is a custom software studio based in Trinidad and Tobago. If a business has a problem software can solve, we build it: internal tools, dashboards, integrations, automations, and customer-facing apps.",
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
            { "@type": "ListItem", "position": 2, "name": "Services", "item": "https://mindelo.site/services" }
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
    {/* ===== SERVICES ===== */}
    <section id="services" className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
        {/* ===== HEADER ===== */}
        <div className="max-w-3xl mb-16 reveal">
            <span className="text-[#00e5b0] text-sm font-bold uppercase tracking-widest">What we do</span>
            <h1 className="text-4xl md:text-6xl heading-heavy mt-3 mb-6">Custom software solutions for Trinidad and Tobago businesses.</h1>
            <p className="text-gray-300 text-lg md:text-xl leading-relaxed">
                We have one specialty: building custom software that solves real business problems. Not a menu of products off a shelf. If your operation has a problem software can solve, we build the system that fixes it, shaped around how you actually work.
            </p>
            <p className="text-gray-400 text-base md:text-lg leading-relaxed mt-4">
                Below are examples of the kinds of software we build for businesses across Trinidad and Tobago and the Caribbean. Yours will be whatever your business needs.
            </p>
        </div>

        {/* ===== INTERNAL TOOLS & DASHBOARDS ===== */}
        <h2 className="text-2xl heading-heavy mb-3 reveal flex items-center gap-3"><span className="inline-block w-6 h-[2px] bg-[#00e5b0] rounded-full"></span>Internal tools and dashboards</h2>
        <p className="text-gray-500 text-sm md:text-base mb-8 reveal max-w-2xl">Software we've built to give teams visibility and take the busywork off their plate.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal" style={{borderTopColor: "var(--teal)"}}>
                <img src="/assets/icons/business-dashboard.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Your whole business on one screen</h3>
                <p className="text-gray-400 text-sm mb-6">Real-time dashboards that pull sales, stock, jobs, and cash into one live view, on any device.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Live KPIs &amp; Metrics</li>
                    <li>Built On Your Data</li>
                    <li>Any Device</li>
                </ul>
            </div>
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal delay-100" style={{borderTopColor: "var(--teal)"}}>
                <img src="/assets/icons/internal-tools.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Software built around your workflow</h3>
                <p className="text-gray-400 text-sm mb-6">Internal tools shaped to your exact process, so your team stops fighting software that was built for someone else.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Built For Your Process</li>
                    <li>Fully Owned By You</li>
                    <li>Fits How Your Team Works</li>
                </ul>
            </div>
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal delay-200" style={{borderTopColor: "var(--teal)"}}>
                <img src="/assets/icons/workflow-automation.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Job and production tracking</h3>
                <p className="text-gray-400 text-sm mb-6">See floor status from the office and let end-of-shift reports write themselves. Built for a labelling and packaging manufacturer.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Intake To Delivery Visibility</li>
                    <li>Automatic Shift Reports</li>
                    <li>Re-print &amp; Rework Tracking</li>
                </ul>
                <a href="/demo/hyline-job-tracker" className="text-[#00e5b0] font-semibold text-sm inline-block mt-5">View the demo &rarr;</a>
            </div>
        </div>

        {/* ===== AUTOMATIONS & INTEGRATIONS ===== */}
        <h2 className="text-2xl heading-heavy mt-20 mb-3 reveal flex items-center gap-3"><span className="inline-block w-6 h-[2px] bg-[#3b9eff] rounded-full"></span>Automations and integrations</h2>
        <p className="text-gray-500 text-sm md:text-base mb-8 reveal max-w-2xl">Software we've built to connect the tools you already use and remove the manual admin in between.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal" style={{borderTopColor: "var(--blue)"}}>
                <img src="/assets/icons/email-follow-up.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Quoting and follow-up systems</h3>
                <p className="text-gray-400 text-sm mb-6">Automated follow-ups so quotes never go cold, plus intake forms that capture every spec the first time. Built for a 50+ year industrial supply business.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Follow-Up On Every Quote</li>
                    <li>Complete Intake Forms</li>
                    <li>Conversion Tracking</li>
                </ul>
                <a href="/demo/aisl-quote-followup" className="text-[#3b9eff] font-semibold text-sm inline-block mt-5">View the demo &rarr;</a>
            </div>
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal delay-100" style={{borderTopColor: "var(--blue)"}}>
                <img src="/assets/icons/system-integrations.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Make your tools talk</h3>
                <p className="text-gray-400 text-sm mb-6">Custom integrations that connect the systems you already run, so the same data stops being re-typed into four different places.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Custom Webhook Logic</li>
                    <li>Legacy System Bridging</li>
                    <li>Real-Time Data Sync</li>
                </ul>
            </div>
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal delay-200" style={{borderTopColor: "var(--blue)"}}>
                <img src="/assets/icons/document-processing.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Turn paperwork into data</h3>
                <p className="text-gray-400 text-sm mb-6">Software that reads invoices, contracts, forms, and PDFs and files the data for you, so nobody re-keys it by hand.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Document &amp; Data Extraction</li>
                    <li>Invoice / Contract / Form Parsing</li>
                    <li>Auto-Sync To Your Systems</li>
                </ul>
            </div>
        </div>

        {/* ===== CUSTOMER-FACING APPS & WEBSITES ===== */}
        <h2 className="text-2xl heading-heavy mt-20 mb-3 reveal flex items-center gap-3"><span className="inline-block w-6 h-[2px] bg-[#8b5cf6] rounded-full"></span>Customer-facing apps and websites</h2>
        <p className="text-gray-500 text-sm md:text-base mb-8 reveal max-w-2xl">Software we've built to give your customers a better way to reach you, book you, and buy from you.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal" style={{borderTopColor: "var(--purple)"}}>
                <img src="/assets/icons/web-development.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Websites with the engine built in</h3>
                <p className="text-gray-400 text-sm mb-6">Custom websites and web apps with the operations baked in: lead capture, bookings, and workflow triggers from day one.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Custom Design &amp; Build</li>
                    <li>Bookings &amp; Lead Capture</li>
                    <li>Built To Convert</li>
                </ul>
            </div>
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal delay-100" style={{borderTopColor: "var(--purple)"}}>
                <img src="/assets/icons/website-chatbot.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Unified inboxes and bookings</h3>
                <p className="text-gray-400 text-sm mb-6">Pull WhatsApp, email, and DMs into one place, with booking tools that prevent double-bookings and send reminders automatically.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>One Unified Inbox</li>
                    <li>No Double-Bookings</li>
                    <li>Automatic Reminders</li>
                </ul>
            </div>
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal delay-200" style={{borderTopColor: "var(--purple)"}}>
                <img src="/assets/icons/customer-portal.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Apps and customer portals</h3>
                <p className="text-gray-400 text-sm mb-6">iOS and Android apps and branded portals your customers log into and use directly, on their own time.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>iOS &amp; Android</li>
                    <li>Branded &amp; Secure</li>
                    <li>24/7 Customer Access</li>
                </ul>
            </div>
        </div>

        {/* ===== DATA, REPORTING & AI WHERE IT FITS ===== */}
        <h2 className="text-2xl heading-heavy mt-20 mb-3 reveal flex items-center gap-3"><span className="inline-block w-6 h-[2px] bg-[#ff6b35] rounded-full"></span>Data, reporting, and AI where it fits</h2>
        <p className="text-gray-500 text-sm md:text-base mb-8 reveal max-w-2xl">Software we've built to turn the data you already have into answers, and to use AI only where it genuinely earns its place.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal" style={{borderTopColor: "var(--orange)"}}>
                <img src="/assets/icons/ask-data.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Ask your data in plain English</h3>
                <p className="text-gray-400 text-sm mb-6">Ask a question in plain language and get an instant answer or chart from your own data. No SQL, no waiting on an analyst.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Natural-Language Queries</li>
                    <li>Instant Charts &amp; Answers</li>
                    <li>Built On Your Data</li>
                </ul>
            </div>
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal delay-100" style={{borderTopColor: "var(--orange)"}}>
                <img src="/assets/icons/forecasting.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">Reporting that runs itself</h3>
                <p className="text-gray-400 text-sm mb-6">Reports and forecasts that generate on schedule and land in your inbox, so nobody spends a Friday afternoon building them by hand.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Scheduled Auto-Reports</li>
                    <li>Sales &amp; Demand Forecasts</li>
                    <li>Synced To Your Systems</li>
                </ul>
            </div>
            <div className="service-card bg-[#0c1018] p-8 rounded-2xl border border-gray-800 reveal delay-200" style={{borderTopColor: "var(--orange)"}}>
                <img src="/assets/icons/brain-network.png" alt="" className="custom-icon service-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold mb-4">One place that knows everything</h3>
                <p className="text-gray-400 text-sm mb-6">A private assistant trained on everything your business knows, so any employee can ask a question and get a straight answer. This is where AI earns its place.</p>
                <ul className="icon-list text-[11px] space-y-2 text-gray-500 font-bold uppercase tracking-tight">
                    <li>Trained On Your Data</li>
                    <li>Instant Answers For Anyone</li>
                    <li>Private &amp; Secure</li>
                </ul>
            </div>
        </div>

        {/* ===== CLOSING CTA ===== */}
        <div className="mt-20 reveal text-center max-w-2xl mx-auto">
            <p className="text-gray-300 text-lg leading-relaxed mb-6">This is a sample of what we build, not a fixed list. Tell us the problem and we'll tell you what software would solve it.</p>
            <a href="/contact" className="bg-[#00e5b0] text-black px-8 py-4 rounded-lg font-bold text-lg inline-flex items-center gap-2 hover:scale-105 transition">Book a Free Consult &rarr;</a>
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
    <Script id="services-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
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
    <Script id="services-1" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `document.querySelector('.nav-link[href="/services"]')?.classList.add('active');` }} />

    </>
  );
}
