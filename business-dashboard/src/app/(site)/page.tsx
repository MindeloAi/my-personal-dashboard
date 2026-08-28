import type { Metadata } from "next";
import Script from "next/script";
import "./_styles/home.css";

export const metadata: Metadata = {
    title: "Mindelo | Custom Software Solutions in Trinidad & Tobago",
    description: "Mindelo is a Trinidad and Tobago custom software studio. If your business has a problem software can solve, we build it. Book a free 30-minute consult.",
    keywords: "custom software Trinidad, custom software solutions Trinidad and Tobago, software company Trinidad, business dashboards, API integrations, workflow automation, Mindelo",
    alternates: {
      canonical: "/",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "Mindelo | Custom Software Solutions in Trinidad & Tobago",
      description: "A Trinidad and Tobago custom software studio. If your business has a problem software can solve, we build it. Book a free 30-minute consult.",
      url: "https://mindelo.site/",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
        width: 1200,
        height: 630,
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Mindelo | Custom Software Solutions in Trinidad & Tobago",
      description: "A Trinidad and Tobago custom software studio. If your business has a problem software can solve, we build it.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function HomePage() {
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
          "@type": "Service",
          "serviceType": "Custom software solutions",
          "provider": { "@id": "https://mindelo.site/#business" },
          "areaServed": { "@type": "Country", "name": "Trinidad and Tobago" },
          "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Mindelo custom software",
            "itemListElement": [
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Custom software development" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Internal tools and business dashboards" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "API integrations between systems" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Customer-facing apps and websites" } },
              { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Workflow automation" } }
            ]
          }
        },
        {
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "Do you build custom software for businesses in Trinidad & Tobago?",
              "acceptedAnswer": { "@type": "Answer", "text": "Yes. Mindelo is a custom software studio based in Trinidad and Tobago, building software for businesses across Trinidad & Tobago and the wider Caribbean. If your operation has a problem software can solve, from quoting and job tracking to dashboards and integrations, we build the system that fixes it." }
            },
            {
              "@type": "Question",
              "name": "What kind of software problems do you solve for a Caribbean small business?",
              "acceptedAnswer": { "@type": "Answer", "text": "Whatever your operation actually needs. For example: quoting and follow-up systems, job and production tracking, unified inboxes and booking tools, custom dashboards that pull sales and stock into one screen, and integrations between systems that do not natively talk. We use automation, and AI where it genuinely helps, but the goal is always the outcome, not the buzzword." }
            },
            {
              "@type": "Question",
              "name": "How much does custom software cost?",
              "acceptedAnswer": { "@type": "Answer", "text": "It depends on what you need, which is why we start with a free 30-minute consult. By the end of that call we tell you the two or three places we would start, what we would build, and roughly what it would cost. Many clients then move to a monthly partnership so the software keeps evolving with the business." }
            },
            {
              "@type": "Question",
              "name": "Do you work with businesses outside Trinidad?",
              "acceptedAnswer": { "@type": "Answer", "text": "Yes. We are based in Trinidad and work with clients across Trinidad & Tobago and the Caribbean. Our software is built for how local businesses actually operate, WhatsApp Business, WiPay, and TT phone formats included." }
            }
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
            <a href="/contact" className="bg-[#00e5b0] text-black px-6 py-2 rounded-full font-bold text-sm hover:scale-105 transition">Book a Consult</a>
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
    {/* ===== HERO ===== */}
    <section id="home" className="relative pt-28 md:pt-36 pb-24 px-6 md:px-12 overflow-hidden min-h-screen flex items-center">
        {/* Subtle looping video backdrop */}
        <video className="hero-video" autoPlay muted loop playsInline preload="auto" poster="/assets/img/hero-poster.jpg" aria-hidden="true">
            <source src="/assets/video/hero-bg.mp4" type="video/mp4" />
        </video>
        {/* Static fallback shown when motion is reduced */}
        <img className="hero-video hero-poster-fallback" src="/assets/img/hero-poster.jpg" alt="" aria-hidden="true" />
        {/* Dark overlay keeps text easy to read */}
        <div className="hero-overlay"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10 reveal">
            <h1 className="text-4xl md:text-6xl lg:text-7xl heading-heavy leading-[1.04] mb-6">
                Stop running your business<br />through your <span className="text-[#00e5b0]">head</span>.
            </h1>
            <p className="text-gray-200 text-lg md:text-2xl mb-10 max-w-2xl mx-auto leading-relaxed">
                Built for Caribbean businesses, around how your operation actually runs.<br />If a problem in your business can be solved with software, we build it.
            </p>
            <div className="flex flex-wrap gap-4 justify-center mb-10">
                <a href="/contact" className="btn-glow bg-[#00e5b0] text-black px-8 py-4 rounded-lg font-bold text-lg flex items-center gap-2 hover:scale-105 transition">Book a Free Consult →</a>
                <a href="/portfolio" className="border border-gray-400 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/10 hover:border-white transition">See Our Work</a>
            </div>
            <div className="flex flex-wrap gap-3 justify-center text-xs md:text-sm uppercase tracking-widest text-gray-300 font-bold">
                <span>Quoting Systems</span> <span className="text-[#00e5b0]/60">/</span> <span>Booking Tools</span> <span className="text-[#00e5b0]/60">/</span> <span>Job Tracking</span> <span className="text-[#00e5b0]/60">/</span> <span>Custom Dashboards</span> <span className="text-[#00e5b0]/60">/</span> <span>API Integrations</span>
            </div>
        </div>
    </section>

    {/* ===== CLIENT LOGO MARQUEE ===== */}
    <section className="py-12 md:py-16 border-y border-white/5" style={{background: "var(--bg)"}}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 mb-9 text-center reveal">
            <p className="text-gray-300 text-sm md:text-base uppercase tracking-widest font-bold">Trusted by businesses across Trinidad &amp; Tobago</p>
        </div>
        <div className="logo-marquee">
            <div className="logo-track">
                {/* set 1 */}
                <div className="logo-item"><img src="/assets/logos/vantage-media.png" alt="Vantage Media Marketing" /></div>
                <div className="logo-item logo-item-light"><img src="/assets/logos/hyline-label.png" alt="Hyline Label Company Ltd." /></div>
                <div className="logo-item"><img src="/assets/logos/taylor.png" alt="Taylor Engineering Agencies Limited" /></div>
                <div className="logo-item logo-item-lg"><img src="/assets/logos/retro-closet.jpg" alt="Retro Closet" /></div>
                <div className="logo-item logo-item-light"><img src="/assets/logos/accurate-industrial.png" alt="Accurate Industrial Supplies Limited" /></div>
                <div className="logo-item logo-wordmark">Decle Realty</div>
                <div className="logo-item logo-item-lg"><img src="/assets/logos/trinity-property.png" alt="Trinity Property Solutions" /></div>
                {/* set 2 */}
                <div className="logo-item" aria-hidden="true"><img src="/assets/logos/vantage-media.png" alt="" /></div>
                <div className="logo-item logo-item-light" aria-hidden="true"><img src="/assets/logos/hyline-label.png" alt="" /></div>
                <div className="logo-item" aria-hidden="true"><img src="/assets/logos/taylor.png" alt="" /></div>
                <div className="logo-item logo-item-lg" aria-hidden="true"><img src="/assets/logos/retro-closet.jpg" alt="" /></div>
                <div className="logo-item logo-item-light" aria-hidden="true"><img src="/assets/logos/accurate-industrial.png" alt="" /></div>
                <div className="logo-item logo-wordmark" aria-hidden="true">Decle Realty</div>
                <div className="logo-item logo-item-lg" aria-hidden="true"><img src="/assets/logos/trinity-property.png" alt="" /></div>
                {/* set 3 */}
                <div className="logo-item" aria-hidden="true"><img src="/assets/logos/vantage-media.png" alt="" /></div>
                <div className="logo-item logo-item-light" aria-hidden="true"><img src="/assets/logos/hyline-label.png" alt="" /></div>
                <div className="logo-item" aria-hidden="true"><img src="/assets/logos/taylor.png" alt="" /></div>
                <div className="logo-item logo-item-lg" aria-hidden="true"><img src="/assets/logos/retro-closet.jpg" alt="" /></div>
                <div className="logo-item logo-item-light" aria-hidden="true"><img src="/assets/logos/accurate-industrial.png" alt="" /></div>
                <div className="logo-item logo-wordmark" aria-hidden="true">Decle Realty</div>
                <div className="logo-item logo-item-lg" aria-hidden="true"><img src="/assets/logos/trinity-property.png" alt="" /></div>
            </div>
        </div>
    </section>

    {/* ===== THE LEAKS ===== */}
    <section className="warm-section py-20 md:py-28 px-6 md:px-12">
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14 reveal">
                <span className="eyebrow text-[#00e5b0]">What you're actually losing</span>
                <h2 className="text-3xl md:text-5xl heading-heavy mt-4 mb-6 leading-tight">
                    The quote you sent last Thursday.<br />Did anyone follow up?
                </h2>
                <p className="text-gray-200 text-lg md:text-xl leading-relaxed">
                    Most Trinidad and Tobago businesses are leaking revenue in places they've stopped noticing. Each one feels small. Added up, they're the difference between a business that runs you and a business you run.
                </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
                <div className="leak-card p-6 reveal">
                    <p className="text-gray-100 text-lg leading-relaxed">A quote sent and forgotten.</p>
                </div>
                <div className="leak-card p-6 reveal delay-100">
                    <p className="text-gray-100 text-lg leading-relaxed">A WhatsApp at 9pm answered at 9am, after the customer has already gone elsewhere.</p>
                </div>
                <div className="leak-card p-6 reveal delay-200">
                    <p className="text-gray-100 text-lg leading-relaxed">A job on the production floor whose status nobody in the office actually knows.</p>
                </div>
                <div className="leak-card p-6 reveal delay-300">
                    <p className="text-gray-100 text-lg leading-relaxed">An invoice that should have been chased two weeks ago.</p>
                </div>
                <div className="leak-card p-6 reveal delay-400">
                    <p className="text-gray-100 text-lg leading-relaxed">A booking made via Instagram DM that was never written down.</p>
                </div>
                <div className="leak-card p-6 reveal delay-500">
                    <p className="text-gray-100 text-lg leading-relaxed">A customer detail re-typed into four different systems.</p>
                </div>
            </div>
            <p className="text-center text-3xl md:text-4xl heading-heavy mt-14 reveal">That's what we fix.</p>
        </div>
    </section>

    {/* ===== WHAT WE BUILD ===== */}
    <section className="py-20 md:py-28 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14 reveal">
                <span className="eyebrow text-[#3b9eff]">What we actually build</span>
                <h2 className="text-3xl md:text-5xl heading-heavy mt-4 mb-6 leading-tight">We build custom software for whatever your operation needs.</h2>
                <p className="text-gray-200 text-lg md:text-xl leading-relaxed">
                    No fixed menu, no "transformation." One specialty: software that fixes the problem in front of you. Custom code where it earns its place, off-the-shelf tools where they fit, AI where it genuinely helps. For example:
                </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
                {/* Card 1 — Quoting & sales */}
                <a href="/demo/aisl-quote-followup" className="build-card reveal">
                    <div className="build-card-top" style={{background: "linear-gradient(90deg, var(--teal), var(--blue))"}}></div>
                    <div className="p-7 flex flex-col flex-1">
                        <img src="/assets/icons/email-follow-up.png" alt="" className="service-icon" />
                        <h3 className="text-2xl font-bold mb-3">Quoting &amp; sales operations</h3>
                        <p className="text-gray-300 text-lg leading-relaxed mb-6 flex-1">Automated follow-ups so quotes never go cold. Intake forms that capture every spec the first time. Conversion tracking so you finally know what's working.</p>
                        <div className="border-t border-white/10 pt-5">
                            <span className="client-tag" style={{background: "rgba(0,229,176,0.12)", color: "var(--teal)"}}>Built for AISL</span>
                            <p className="text-gray-400 text-sm leading-relaxed mt-3">Automated follow-up system on every outgoing quote, for a 50+ year industrial supply business.</p>
                            <span className="text-[#00e5b0] font-semibold text-sm inline-block mt-4">View the demo <span className="demo-arrow">→</span></span>
                        </div>
                    </div>
                </a>
                {/* Card 2 — Job tracking */}
                <a href="/demo/hyline-job-tracker" className="build-card reveal delay-200">
                    <div className="build-card-top" style={{background: "linear-gradient(90deg, var(--blue), var(--purple))"}}></div>
                    <div className="p-7 flex flex-col flex-1">
                        <img src="/assets/icons/business-dashboard.png" alt="" className="service-icon" />
                        <h3 className="text-2xl font-bold mb-3">Job tracking &amp; production visibility</h3>
                        <p className="text-gray-300 text-lg leading-relaxed mb-6 flex-1">Custom apps that show your floor status from the office. End-of-shift reports that write themselves. Re-print and rework tracking. Tools your team will actually use.</p>
                        <div className="border-t border-white/10 pt-5">
                            <span className="client-tag" style={{background: "rgba(59,158,255,0.12)", color: "var(--blue)"}}>Built for Hyline</span>
                            <p className="text-gray-400 text-sm leading-relaxed mt-3">Job ticket tracking from intake to delivery, for a labelling and packaging manufacturer.</p>
                            <span className="text-[#3b9eff] font-semibold text-sm inline-block mt-4">View the demo <span className="demo-arrow">→</span></span>
                        </div>
                    </div>
                </a>
                {/* Card 3 — Customer comms */}
                <a href="/demo" className="build-card reveal delay-400">
                    <div className="build-card-top" style={{background: "linear-gradient(90deg, var(--purple), var(--orange))"}}></div>
                    <div className="p-7 flex flex-col flex-1">
                        <img src="/assets/icons/website-chatbot.png" alt="" className="service-icon" />
                        <h3 className="text-2xl font-bold mb-3">Customer communication &amp; bookings</h3>
                        <p className="text-gray-300 text-lg leading-relaxed mb-6 flex-1">Unified inboxes pulling WhatsApp, email, and DMs into one place. Booking systems that prevent double-bookings and send reminders. Chat assistants trained on your real products.</p>
                        <div className="border-t border-white/10 pt-5">
                            <span className="client-tag" style={{background: "rgba(139,92,246,0.14)", color: "var(--purple)"}}>Built for AISL</span>
                            <p className="text-gray-400 text-sm leading-relaxed mt-3">Industrial supply chatbot trained on a full product catalogue, plus website and CRM integration.</p>
                            <span className="text-[#8b5cf6] font-semibold text-sm inline-block mt-4">View the demo <span className="demo-arrow">→</span></span>
                        </div>
                    </div>
                </a>
            </div>
            <div className="text-center max-w-3xl mx-auto mt-12 reveal">
                <p className="text-gray-300 text-lg leading-relaxed mb-4">
                    We also build internal tools, custom dashboards, payment integrations, API connections between systems that don't natively talk, and full custom websites with operations baked in.
                </p>
                <a href="/services" className="text-[#00e5b0] font-bold text-lg hover:underline">See all services →</a>
            </div>
        </div>
    </section>

    {/* ===== WHO WE ARE ===== */}
    <section className="warm-section py-20 md:py-28 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="reveal">
                {/* TODO: Replace with real photo of Zane + Michael */}
                <img src="/assets/img/hero-people.jpg" alt="The Mindelo founding team" className="photo-frame rounded-2xl w-full h-auto shadow-2xl" loading="lazy" />
            </div>
            <div className="reveal delay-200">
                <span className="eyebrow text-[#00e5b0]">Built by a real local team</span>
                <h2 className="text-3xl md:text-5xl heading-heavy mt-3 mb-6 leading-tight">We don't deliver and disappear.</h2>
                <p className="text-gray-200 text-lg md:text-xl leading-relaxed mb-5">
                    Mindelo was founded by Zane Adams and Michael Taylor Walker. We're based in Trinidad. Our work is wired for WhatsApp Business, WiPay, TT phone formats, and the way local businesses actually operate.
                </p>
                <p className="text-gray-300 text-lg leading-relaxed mb-6">
                    Most of our clients move into a monthly partnership where we keep the systems running, adjust them as the business changes, and build the next thing when it's needed. You won't be talking to a different person every quarter. You'll be talking to us.
                </p>
                <a href="/about" className="text-[#00e5b0] font-bold text-lg hover:underline">More about how we work →</a>
            </div>
        </div>
    </section>

    {/* ===== FREE CONSULT CTA BAND ===== */}
    <section className="py-20 md:py-28 px-6 md:px-12">
        <div className="max-w-5xl mx-auto consult-band rounded-3xl p-10 md:p-16 text-center reveal">
            <span className="eyebrow text-[#3b9eff]" style={{justifyContent: "center"}}>Free 30-minute consult</span>
            <h2 className="text-3xl md:text-5xl heading-heavy mt-4 mb-6 leading-tight">Start with a free conversation.</h2>
            <p className="text-gray-200 text-lg md:text-xl leading-relaxed mb-5 max-w-3xl mx-auto">
                No pitch deck. No hard close. You walk us through your business. We ask focused questions. By the end of the call, we'll tell you the two or three places we'd start: what we'd build, roughly what it would cost, and what you'd get back.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed mb-9 max-w-3xl mx-auto">
                If we're the right fit, we'll talk about working together. If we're not, we'll tell you honestly and point you somewhere that is. Either way, you leave with a clearer picture of where your operation is leaking.
            </p>
            <a href="/contact" className="btn-glow inline-block bg-[#00e5b0] text-black px-10 py-4 rounded-lg font-bold text-lg hover:scale-105 transition">Book your free consult →</a>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-9 text-gray-200 font-semibold">
                <span className="consult-check"><span className="about-check-icon"></span> 30 minutes</span>
                <span className="consult-check"><span className="about-check-icon"></span> No obligation</span>
                <span className="consult-check"><span className="about-check-icon"></span> Real conversation, not a sales call</span>
            </div>
        </div>
    </section>

    {/* ===== FAQ ===== */}
    <section className="py-20 md:py-28 px-6 md:px-12" id="faq">
        <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 reveal">
                <span className="eyebrow text-[#00e5b0]" style={{justifyContent: "center"}}>Common questions</span>
                <h2 className="text-3xl md:text-5xl heading-heavy mt-3 leading-tight">Custom software in Trinidad &amp; Tobago, answered.</h2>
            </div>
            <div className="space-y-4">
                <details className="faq-item reveal bg-[#0c1018] border border-gray-800 rounded-2xl p-6">
                    <summary className="font-bold text-lg text-white cursor-pointer list-none flex justify-between items-center gap-4">Do you build custom software for businesses in Trinidad &amp; Tobago?<span className="faq-plus text-[#00e5b0] text-2xl leading-none">+</span></summary>
                    <p className="text-gray-300 leading-relaxed mt-4">Yes. Mindelo is a custom software studio based in Trinidad and Tobago, building software for businesses across Trinidad &amp; Tobago and the wider Caribbean. If your operation has a problem software can solve, from quoting and job tracking to dashboards and integrations, we build the system that fixes it.</p>
                </details>
                <details className="faq-item reveal bg-[#0c1018] border border-gray-800 rounded-2xl p-6">
                    <summary className="font-bold text-lg text-white cursor-pointer list-none flex justify-between items-center gap-4">What kind of software problems do you solve for a Caribbean small business?<span className="faq-plus text-[#00e5b0] text-2xl leading-none">+</span></summary>
                    <p className="text-gray-300 leading-relaxed mt-4">Whatever your operation actually needs. For example: quoting and follow-up systems, job and production tracking, unified inboxes and booking tools, custom dashboards that pull sales and stock into one screen, and integrations between systems that do not natively talk. We use automation, and AI where it genuinely helps, but the goal is always the outcome, not the buzzword.</p>
                </details>
                <details className="faq-item reveal bg-[#0c1018] border border-gray-800 rounded-2xl p-6">
                    <summary className="font-bold text-lg text-white cursor-pointer list-none flex justify-between items-center gap-4">How much does custom software cost?<span className="faq-plus text-[#00e5b0] text-2xl leading-none">+</span></summary>
                    <p className="text-gray-300 leading-relaxed mt-4">It depends on what you need, which is why we start with a free 30-minute consult. By the end of that call we tell you the two or three places we would start, what we would build, and roughly what it would cost. Many clients then move to a monthly partnership so the software keeps evolving with the business.</p>
                </details>
                <details className="faq-item reveal bg-[#0c1018] border border-gray-800 rounded-2xl p-6">
                    <summary className="font-bold text-lg text-white cursor-pointer list-none flex justify-between items-center gap-4">Do you work with businesses outside Trinidad?<span className="faq-plus text-[#00e5b0] text-2xl leading-none">+</span></summary>
                    <p className="text-gray-300 leading-relaxed mt-4">Yes. We are based in Trinidad and work with clients across Trinidad &amp; Tobago and the Caribbean. Our software is built for how local businesses actually operate, WhatsApp Business, WiPay, and TT phone formats included.</p>
                </details>
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
    <Script id="home-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
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

        // --- BFCACHE RESTORE FIX ---
        window.addEventListener('pageshow', function(e) {
            if (e.persisted) {
                document.body.classList.remove('page-exit');
                document.body.style.animation = 'pageIn 0.4s ease';
            }
        });

        // --- MOBILE VIDEO AUTOPLAY FALLBACK ---
        // iOS Low Power Mode and Chrome Data Saver can block autoplay even for muted videos.
        // Catch the rejection and retry on first user gesture.
        (function () {
            const vid = document.querySelector('video.hero-video');
            if (!vid) return;
            function unlock() {
                vid.play().catch(function () {});
            }
            const p = vid.play();
            if (p !== undefined) {
                p.catch(function () {
                    document.addEventListener('touchstart', unlock, { once: true });
                    document.addEventListener('click', unlock, { once: true });
                });
            }
        })();

        // --- LOGO MARQUEE DRAG ---
        (function() {
            const marquee = document.querySelector('.logo-marquee');
            const track = document.querySelector('.logo-track');
            if (!marquee || !track) return;

            let dragging = false, startX = 0, dragOffset = 0, baseOffset = 0;

            function getCurrentX() {
                const m = new DOMMatrix(getComputedStyle(track).transform);
                return m.m41;
            }

            function startDrag(x) {
                dragging = true;
                startX = x;
                baseOffset = getCurrentX();
                track.style.animationPlayState = 'paused';
                marquee.classList.add('dragging');
            }

            function moveDrag(x) {
                if (!dragging) return;
                dragOffset = x - startX;
                track.style.transform = 'translateX(' + (baseOffset + dragOffset) + 'px)';
            }

            function endDrag() {
                if (!dragging) return;
                dragging = false;
                marquee.classList.remove('dragging');

                // Compute where we are and restart animation from that position
                const setWidth = track.scrollWidth / 3;
                let pos = baseOffset + dragOffset;
                // Wrap into [-setWidth, 0] range
                pos = ((pos % setWidth) - setWidth) % setWidth;
                const progress = Math.abs(pos) / setWidth;
                const duration = 55;

                track.style.transform = '';
                track.style.animationDelay = (-progress * duration) + 's';
                track.style.animationPlayState = 'running';
            }

            marquee.addEventListener('mousedown', e => { startDrag(e.clientX); e.preventDefault(); });
            window.addEventListener('mousemove', e => moveDrag(e.clientX));
            window.addEventListener('mouseup', endDrag);

            marquee.addEventListener('touchstart', e => { startDrag(e.touches[0].clientX); }, { passive: true });
            window.addEventListener('touchmove', e => moveDrag(e.touches[0].clientX), { passive: true });
            window.addEventListener('touchend', endDrag);
        })();
    ` }} />
    <Script id="home-1" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `document.querySelector('.nav-link[href="/"]')?.classList.add('active');` }} />

    </>
  );
}
