import type { Metadata } from "next";
import Script from "next/script";
import "../_styles/portfolio.css";

export const metadata: Metadata = {
    title: "Portfolio: Custom Software Projects | Mindelo Trinidad & Tobago",
    description: "See real custom software Mindelo has built for Trinidad and Tobago and Caribbean businesses: dashboards, job tracking, quoting systems, and more.",
    alternates: {
      canonical: "/portfolio",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "Portfolio: Custom Software Projects | Mindelo Trinidad & Tobago",
      description: "Real custom software Mindelo has built for Trinidad and Tobago and Caribbean businesses: dashboards, job tracking, and quoting systems.",
      url: "https://mindelo.site/portfolio",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Portfolio: Custom Software Projects | Mindelo Trinidad & Tobago",
      description: "Real custom software Mindelo has built for Trinidad and Tobago and Caribbean businesses.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function PortfolioPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: `
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": [
            "ProfessionalService",
            "Organization"
          ],
          "@id": "https://mindelo.site/#business",
          "name": "Mindelo",
          "alternateName": "Mindelo Solutions",
          "url": "https://mindelo.site/",
          "image": "https://mindelo.site/assets/img/og-image.jpg",
          "logo": "https://mindelo.site/favicon-96x96.png",
          "knowsAbout": [
            "custom software development",
            "custom software solutions",
            "business dashboards",
            "API integrations",
            "internal business tools",
            "customer-facing web apps",
            "workflow automation",
            "software company Trinidad and Tobago"
          ],
          "slogan": "Custom software solutions for Trinidad and Tobago and the Caribbean",
          "description": "Mindelo is a custom software studio based in Trinidad and Tobago. If a business has a problem software can solve, we build it: internal tools, dashboards, integrations, automations, and customer-facing apps.",
          "email": "admin@mindelo.site",
          "telephone": "+18683612254",
          "priceRange": "$$",
          "founder": [
            {
              "@type": "Person",
              "name": "Zane Adams",
              "sameAs": ["https://www.linkedin.com/in/zane-adams-380630277/"]
            },
            {
              "@type": "Person",
              "name": "Michael Taylor Walker",
              "sameAs": ["https://www.linkedin.com/in/michael-taylor-walker-3b64a73b9/"]
            }
          ],
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "19 Stanmore Avenue",
            "addressLocality": "Port of Spain",
            "addressCountry": "TT"
          },
          "areaServed": [
            {
              "@type": "Country",
              "name": "Trinidad and Tobago"
            },
            {
              "@type": "Place",
              "name": "Caribbean"
            }
          ],
          "sameAs": [
            "https://www.instagram.com/mindelo_solutions/",
            "https://www.facebook.com/profile.php?id=61579117153959"
          ]
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://mindelo.site/"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Portfolio",
              "item": "https://mindelo.site/portfolio"
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
    {/* ===== PORTFOLIO ===== */}
    <section id="portfolio" className="py-32 px-6 md:px-12 bg-black/20">
        <div className="max-w-7xl mx-auto">
            <div className="mb-16 reveal">
                <span className="text-[#3b9eff] text-sm font-bold uppercase tracking-widest">Our Work</span>
                <h2 className="text-3xl md:text-5xl heading-heavy mt-2">Portfolio</h2>
                <p className="text-gray-500 mt-3 text-sm">A selection of websites, dashboards, and automations we've built.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">

                {/* ===== WEBSITES SUBSECTION ===== */}
                <div className="md:col-span-2 reveal">
                    <span className="text-[#f43f5e] text-xs font-bold uppercase tracking-widest">Section 01</span>
                    <h3 className="text-2xl md:text-4xl heading-heavy mt-2">Websites</h3>
                    <p className="text-gray-500 mt-2 text-sm">Custom-built websites for clients across e-commerce and real estate.</p>
                </div>
                {/* Project 07 -- Retro Closet E-Commerce Website */}
                <div className="portfolio-card reveal delay-200 cursor-pointer group" style={{"--card-accent": "#f43f5e"} as React.CSSProperties} data-accent="#f43f5e" data-badge="Client Project" data-category="E-Commerce / Web Design" data-title="Retro Closet - E-Commerce Website" data-description="Custom e-commerce website built for Retro Closet, a vintage clothing brand. Features a full product catalogue, shopping cart, and a branded storefront designed to match the store's retro aesthetic." data-image="/assets/portfolio/port-1.jpg" data-tags="HTML|CSS|JavaScript|E-Commerce|Web Design" data-url="https://retrocloset.org">
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <img src="/assets/portfolio/port-1.jpg" alt="Retro Closet E-Commerce Website" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#f43f5e]/10 border border-[#f43f5e]/20 text-[#f43f5e] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e]"></span> Client Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7">
                            <span className="text-[#f43f5e] text-[10px] font-bold uppercase tracking-widest">E-Commerce / Web Design</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">Retro Closet: E-Commerce Website</h4>
                            <p className="text-gray-500 text-sm">Custom e-commerce website built for Retro Closet, a vintage clothing brand. Features a full product catalogue, shopping cart, and a branded storefront designed to match the store's retro aesthetic.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">HTML</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">CSS</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">JavaScript</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">E-Commerce</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Web Design</span>
                            </div>
                            <a href="https://retrocloset.org" target="_blank" rel="noopener noreferrer" data-stop-propagation="" className="inline-flex items-center gap-1.5 mt-5 text-[#f43f5e] text-xs font-bold uppercase tracking-widest hover:opacity-70 transition-opacity">
                                retrocloset.org
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Project 08 -- Decle Reality Real Estate Website */}
                <div className="portfolio-card reveal delay-300 cursor-pointer group" style={{"--card-accent": "#10b981"} as React.CSSProperties} data-accent="#10b981" data-badge="Client Project" data-category="Real Estate / Web Design" data-title="Decle Reality - Real Estate Website" data-description="Custom website built for Decle Reality, a real estate agent. Features property listings, agent contact details, and a clean professional design tailored to showcase available properties to potential buyers and renters." data-image="/assets/portfolio/port-2.jpg" data-tags="HTML|CSS|JavaScript|Real Estate|Web Design" data-url="https://declerealty.net">
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <img src="/assets/portfolio/port-2.jpg" alt="Decle Reality Real Estate Website" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span> Client Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7">
                            <span className="text-[#10b981] text-[10px] font-bold uppercase tracking-widest">Real Estate / Web Design</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">Decle Reality: Real Estate Website</h4>
                            <p className="text-gray-500 text-sm">Custom website built for Decle Reality, a real estate agent. Features property listings, agent contact, and a clean professional design tailored to showcase available properties.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">HTML</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">CSS</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">JavaScript</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Real Estate</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Web Design</span>
                            </div>
                            <a href="https://declerealty.net" target="_blank" rel="noopener noreferrer" data-stop-propagation="" className="inline-flex items-center gap-1.5 mt-5 text-[#10b981] text-xs font-bold uppercase tracking-widest hover:opacity-70 transition-opacity">
                                declerealty.net
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            </a>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2 reveal">
                    <a href="/websites" className="inline-flex items-center gap-2 text-[#00e5b0] text-xs font-bold uppercase tracking-widest hover:opacity-70 transition-opacity">
                        See all websites we&apos;ve built &rarr;
                    </a>
                </div>

                {/* ===== CUSTOM APPS SUBSECTION ===== */}
                <div className="md:col-span-2 reveal mt-16">
                    <span className="text-[#00e5b0] text-xs font-bold uppercase tracking-widest">Section 02</span>
                    <h3 className="text-2xl md:text-4xl heading-heavy mt-2">Custom Apps</h3>
                    <p className="text-gray-500 mt-2 text-sm">Custom software built for real clients, live in production.</p>
                </div>

                {/* AISL Quote Follow-up System */}
                <a href="/demo/aisl-quote-followup" className="portfolio-card reveal delay-200 group block" style={{"--card-accent": "#00e5b0"} as React.CSSProperties}>
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500 h-full flex flex-col">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <div className="w-full h-full bg-gradient-to-br from-[#0a1a14] to-[#0c1018] flex items-center justify-center">
                                <div className="grid grid-cols-2 gap-3 p-6 w-full opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                                    <div className="bg-[#111827] border border-white/5 rounded-lg p-3">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Conversion</div>
                                        <div className="text-xl font-black text-[#00e5b0]">34%</div>
                                        <div className="text-[9px] text-[#4ade80] mt-0.5">↑ +11% vs last quarter</div>
                                    </div>
                                    <div className="bg-[#111827] border border-white/5 rounded-lg p-3">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Revenue recovered</div>
                                        <div className="text-base font-black text-[#00e5b0] leading-tight">TTD 47,200</div>
                                    </div>
                                    <div className="bg-[#111827] border border-[#00e5b0]/20 rounded-lg p-3 col-span-2">
                                        <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1.5">Automation Timeline</div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-[#00e5b0] shadow-[0_0_8px_#00e5b0]"></div>
                                            <div className="flex-1 h-px bg-[#00e5b0]/40"></div>
                                            <div className="w-3 h-3 rounded-full bg-[#00e5b0] shadow-[0_0_8px_#00e5b0]"></div>
                                            <div className="flex-1 h-px bg-white/10"></div>
                                            <div className="w-3 h-3 rounded-full bg-[#111827] border-2 border-gray-600"></div>
                                        </div>
                                        <div className="text-[9px] text-gray-600 mt-1.5">Day 0 · Follow-up #1 · Follow-up #2</div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/70 to-transparent pointer-events-none"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#00e5b0]/10 border border-[#00e5b0]/20 text-[#00e5b0] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#00e5b0]"></span> Client Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7 flex flex-col flex-1">
                            <span className="text-[#00e5b0] text-[10px] font-bold uppercase tracking-widest">Industrial Supply / Sales Operations</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">AISL: Quote Follow-up System</h4>
                            <p className="text-gray-500 text-sm flex-1">Automated follow-up system built for Accurate Industrial Supplies Ltd. Every outgoing quote triggers a timed sequence, so follow-ups are sent automatically, replies are logged, and conversion is tracked without manual effort.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Custom App</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Automation</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">CRM</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Email</span>
                            </div>
                            <span className="inline-flex items-center gap-1.5 mt-5 text-[#00e5b0] text-xs font-bold uppercase tracking-widest group-hover:opacity-70 transition-opacity">
                                View interactive demo
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                            </span>
                        </div>
                    </div>
                </a>

                {/* Hyline Job Tracker */}
                <a href="/demo/hyline-job-tracker" className="portfolio-card reveal delay-300 group block" style={{"--card-accent": "#3b9eff"} as React.CSSProperties}>
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500 h-full flex flex-col">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <div className="w-full h-full bg-gradient-to-br from-[#0a0f1a] to-[#0c1018] flex items-center justify-center">
                                <div className="p-5 w-full opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                                    <div className="flex gap-2 mb-2">
                                        <div className="flex-1 bg-[#111827] border border-white/5 rounded-lg p-2.5">
                                            <div className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">In production</div>
                                            <div className="text-lg font-black text-[#3b9eff]">12</div>
                                        </div>
                                        <div className="flex-1 bg-[#111827] border border-white/5 rounded-lg p-2.5">
                                            <div className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">On-time rate</div>
                                            <div className="text-lg font-black text-[#3b9eff]">94%</div>
                                        </div>
                                        <div className="flex-1 bg-[#111827] border border-white/5 rounded-lg p-2.5">
                                            <div className="text-[8px] text-gray-500 uppercase tracking-widest mb-1">Done today</div>
                                            <div className="text-lg font-black text-[#3b9eff]">4</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        <div className="bg-[#111827] border border-white/5 rounded p-1.5 text-center">
                                            <div className="text-[8px] text-gray-600 uppercase tracking-widest">Intake</div>
                                            <div className="text-sm font-bold text-gray-300 mt-0.5">2</div>
                                        </div>
                                        <div className="bg-[#111827] border border-[#3b9eff]/20 rounded p-1.5 text-center">
                                            <div className="text-[8px] text-[#3b9eff] uppercase tracking-widest">Press</div>
                                            <div className="text-sm font-bold text-[#3b9eff] mt-0.5">5</div>
                                        </div>
                                        <div className="bg-[#111827] border border-white/5 rounded p-1.5 text-center">
                                            <div className="text-[8px] text-gray-600 uppercase tracking-widest">QC</div>
                                            <div className="text-sm font-bold text-gray-300 mt-0.5">2</div>
                                        </div>
                                        <div className="bg-[#111827] border border-white/5 rounded p-1.5 text-center">
                                            <div className="text-[8px] text-gray-600 uppercase tracking-widest">Ready</div>
                                            <div className="text-sm font-bold text-gray-300 mt-0.5">3</div>
                                        </div>
                                        <div className="bg-[#111827] border border-white/5 rounded p-1.5 text-center">
                                            <div className="text-[8px] text-gray-600 uppercase tracking-widest">Done</div>
                                            <div className="text-sm font-bold text-gray-300 mt-0.5">2</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/70 to-transparent pointer-events-none"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#3b9eff]/10 border border-[#3b9eff]/20 text-[#3b9eff] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#3b9eff]"></span> Client Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7 flex flex-col flex-1">
                            <span className="text-[#3b9eff] text-[10px] font-bold uppercase tracking-widest">Label Manufacturing / Production Visibility</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">Hyline: Job Tracker</h4>
                            <p className="text-gray-500 text-sm flex-1">Production floor tracking app built for Hyline Label Company. Jobs move through a live kanban board from intake to delivery, with operator notes, re-print logging, and end-of-shift reports that generate automatically.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Custom App</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Kanban</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Production</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Reporting</span>
                            </div>
                            <span className="inline-flex items-center gap-1.5 mt-5 text-[#3b9eff] text-xs font-bold uppercase tracking-widest group-hover:opacity-70 transition-opacity">
                                View interactive demo
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                            </span>
                        </div>
                    </div>
                </a>

                {/* ===== AUTOMATIONS SUBSECTION ===== */}
                <div className="md:col-span-2 reveal mt-16">
                    <span className="text-[#00e5b0] text-xs font-bold uppercase tracking-widest">Section 03</span>
                    <h3 className="text-2xl md:text-4xl heading-heavy mt-2">Automations</h3>
                    <p className="text-gray-500 mt-2 text-sm">Workflow automations built for businesses.</p>
                </div>
                {/* Project 03 */}
                <div className="portfolio-card reveal delay-200 cursor-pointer group" style={{"--card-accent": "#8b5cf6"} as React.CSSProperties} data-accent="#8b5cf6" data-badge="Demo Project" data-category="Trades / Lead Recovery" data-title="WhatsApp Recovery Agent for Electricians" data-description="Missed call recovery system that automatically starts a WhatsApp conversation, automatically qualifies the lead and answers common questions, logs all data to Google Sheets, and notifies the owner by email when a booking is ready or the lead is urgent." data-image="/assets/portfolio/port-3.jpg" data-tags="n8n|OpenAI|WhatsApp|Google Sheets|Gmail">
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <img src="/assets/portfolio/port-3.jpg" alt="WhatsApp Recovery Agent for Electricians workflow" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 text-[#8b5cf6] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]"></span> Demo Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7">
                            <span className="text-[#8b5cf6] text-[10px] font-bold uppercase tracking-widest">Trades / Lead Recovery</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">WhatsApp Recovery Agent for Electricians</h4>
                            <p className="text-gray-500 text-sm">Missed call recovery system that automatically starts a WhatsApp conversation, automatically qualifies the lead and answers common questions, logs all data to Google Sheets, and notifies the owner by email when a booking is ready or the lead is urgent.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">n8n</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">OpenAI</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">WhatsApp</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Google Sheets</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Gmail</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project 04 */}
                <div className="portfolio-card reveal delay-300 cursor-pointer group" style={{"--card-accent": "#ff6b35"} as React.CSSProperties} data-accent="#ff6b35" data-badge="Demo Project" data-category="Agency / Lead Gen" data-title="Local Business Outreach Agent" data-description="Identifies local plumbing businesses, evaluates their automation potential, and generates personalized outreach email drafts automatically, simulating how an agency could build a targeted prospect pipeline at scale." data-image="/assets/portfolio/port-4.jpg" data-tags="n8n|OpenAI|Google Sheets|Lead Scoring">
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <img src="/assets/portfolio/port-4.jpg" alt="Local Business Outreach Agent workflow" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#ff6b35]/10 border border-[#ff6b35]/20 text-[#ff6b35] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff6b35]"></span> Demo Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7">
                            <span className="text-[#ff6b35] text-[10px] font-bold uppercase tracking-widest">Agency / Lead Gen</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">Local Business Outreach Agent</h4>
                            <p className="text-gray-500 text-sm">Identifies local plumbing businesses, evaluates their automation potential, and generates personalized outreach email drafts automatically, simulating how an agency could build a targeted prospect pipeline at scale.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">n8n</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">OpenAI</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Google Sheets</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Lead Scoring</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project 05 */}
                <div className="portfolio-card reveal delay-400 cursor-pointer group" style={{"--card-accent": "#00e5b0"} as React.CSSProperties} data-accent="#00e5b0" data-badge="Demo Project" data-category="Productivity / Assistant" data-title="Personal Assistant" data-description="A smart assistant connected to Google Calendar, Google Tasks, and a financial tracker, capable of scheduling events, managing tasks, and reading financial data through natural conversation." data-image="/assets/portfolio/port-5.jpg" data-tags="n8n|ChatGPT|Google Calendar|Google Tasks|Google Sheets">
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <img src="/assets/portfolio/port-5.jpg" alt="Personal Assistant workflow" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#00e5b0]/10 border border-[#00e5b0]/20 text-[#00e5b0] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#00e5b0]"></span> Demo Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7">
                            <span className="text-[#00e5b0] text-[10px] font-bold uppercase tracking-widest">Productivity / Assistant</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">Personal Assistant</h4>
                            <p className="text-gray-500 text-sm">A smart assistant connected to Google Calendar, Google Tasks, and a financial tracker, capable of scheduling events, managing tasks, and reading financial data through natural conversation.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">n8n</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">ChatGPT</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Google Calendar</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Google Tasks</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Google Sheets</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project 04: Voice Receptionist */}
                <div className="portfolio-card reveal delay-300 cursor-pointer group" style={{"--card-accent": "#3b9eff"} as React.CSSProperties} data-accent="#3b9eff" data-badge="Demo Project" data-category="Voice / Receptionist" data-title="Voice Receptionist" data-description="Central call orchestrator built with VAPI and n8n. Handles all inbound voice calls, acting as a smart receptionist that routes calls to 6 sub-workflows that manage client lookup, availability checking, appointment booking, event management, and updates." data-image="/assets/portfolio/port-6.jpg" data-tags="VAPI|n8n|OpenAI|Google Sheets">
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <img src="/assets/portfolio/port-6.jpg" alt="Voice Receptionist workflow" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#3b9eff]/10 border border-[#3b9eff]/20 text-[#3b9eff] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#3b9eff]"></span> Demo Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7">
                            <span className="text-[#3b9eff] text-[10px] font-bold uppercase tracking-widest">Voice / Receptionist</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">Voice Receptionist</h4>
                            <p className="text-gray-500 text-sm">Central call orchestrator built with VAPI and n8n. Handles all inbound voice calls, acting as a smart receptionist that routes calls to 6 sub-workflows that manage client lookup, availability checking, appointment booking, event management, and updates.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">VAPI</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">n8n</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">OpenAI</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Google Sheets</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== DASHBOARDS SUBSECTION ===== */}
                <div className="md:col-span-2 reveal mt-16">
                    <span className="text-[#f59e0b] text-xs font-bold uppercase tracking-widest">Section 04</span>
                    <h3 className="text-2xl md:text-4xl heading-heavy mt-2">Dashboards</h3>
                    <p className="text-gray-500 mt-2 text-sm">Operations dashboards for tracking projects, finances, and team workflows.</p>
                </div>

                {/* Project 05 -- Agency Dashboard */}
                <div className="portfolio-card reveal delay-200 cursor-pointer group" style={{"--card-accent": "#f59e0b"} as React.CSSProperties} data-accent="#f59e0b" data-badge="Personal Project" data-category="Personal Tool / Business Analytics" data-title="Agency Operations Dashboard" data-description="Personal dashboard for managing a software & automation agency day-to-day. Tracks revenue, outstanding invoices, expenses, and net profit with interactive multi-period charts. Features a Kanban project board (Lead to In Progress to Review to Done), client count, lead pipeline value, and expense breakdown by category." data-image="/assets/portfolio/port-7.jpg" data-tags="HTML|CSS|JavaScript|Chart.js|Finance|Dashboard">
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <img src="/assets/portfolio/port-7.jpg" alt="Agency Operations Dashboard" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#f59e0b]/10 border border-[#f59e0b]/20 text-[#f59e0b] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span> Personal Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7">
                            <span className="text-[#f59e0b] text-[10px] font-bold uppercase tracking-widest">Personal Tool / Business Analytics</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">Agency Operations Dashboard</h4>
                            <p className="text-gray-500 text-sm">Personal dashboard for managing a software & automation agency. Tracks revenue, expenses, net profit, and pipeline value with interactive charts. Includes a Kanban project board, client metrics, and invoice management.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">HTML</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">CSS</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">JavaScript</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Chart.js</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Dashboard</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Project 06 -- Vantage Media Control Centre */}
                <div className="portfolio-card reveal delay-300 cursor-pointer group" style={{"--card-accent": "#a855f7"} as React.CSSProperties} data-accent="#a855f7" data-badge="Client Project" data-category="Client Project / Agency Management" data-title="Vantage Media - Agency Control Centre" data-description="Operations dashboard built for a social media agency (Vantage Media). Features real-time project tracking, task assignment by team member, overdue task monitoring, invoice management, and built-in automation triggers for deadline checks and payment reminders via n8n." data-image="/assets/portfolio/port-8.jpg" data-tags="HTML|CSS|JavaScript|n8n|Dashboard|Team Management">
                    <div className="card-border bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden transition-all duration-500">
                        <div className="relative h-48 overflow-hidden border-b border-gray-800">
                            <img src="/assets/portfolio/port-8.jpg" alt="Vantage Media Agency Control Centre" className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent"></div>
                            <div className="absolute top-4 left-4">
                                <div className="inline-flex items-center gap-2 bg-[#a855f7]/10 border border-[#a855f7]/20 text-[#a855f7] text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]"></span> Client Project
                                </div>
                            </div>
                        </div>
                        <div className="p-7">
                            <span className="text-[#a855f7] text-[10px] font-bold uppercase tracking-widest">Client Project / Agency Management</span>
                            <h4 className="text-xl font-bold mt-1 mb-3">Vantage Media - Agency Control Centre</h4>
                            <p className="text-gray-500 text-sm">Operations dashboard built for a social media agency. Features project and task tracking, team member assignment, overdue alerts, invoice management, and n8n automation triggers for deadline checks and payment reminders.</p>
                            <div className="flex flex-wrap gap-2 mt-4">
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">HTML</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">CSS</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">JavaScript</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">n8n</span>
                                <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-1 rounded font-bold uppercase">Dashboard</span>
                            </div>
                        </div>
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
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase">
                <span className="text-gray-600">© 2026 Mindelo. Built in Trinidad.</span>
                <a href="/websites" className="text-gray-500 hover:text-white transition">Websites</a>
            </div>
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
    {/* ===== PROJECT MODAL ===== */}
    <div id="project-modal" className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-panel bg-[#0c1018] rounded-3xl overflow-hidden shadow-2xl max-w-full md:max-w-3xl w-full mx-4">
            <div id="modal-img-wrap" className="relative h-72 overflow-hidden">
                <img id="modal-img" src="" alt="" className="w-full h-full object-cover object-top" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1018]/60 to-transparent"></div>
                <div id="modal-visit" className="hidden absolute bottom-4 left-4 items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full bg-black/60 backdrop-blur text-white pointer-events-none transition-opacity">
                    Visit live site
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                </div>
                <div id="modal-strip" className="absolute top-0 left-0 w-full h-1"></div>
                <button id="modal-close" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-gray-300 hover:text-white hover:bg-black/80 transition text-lg font-light"><img src="/assets/icons/close-control.png" alt="" className="modal-close-icon" aria-hidden="true" /></button>
                <div className="absolute top-4 left-4">
                    <div id="modal-badge" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full"></div>
                </div>
            </div>
            <div className="p-8">
                <span id="modal-category" className="text-[10px] font-bold uppercase tracking-widest"></span>
                <h3 id="modal-title" className="text-3xl font-black mt-1 mb-4 leading-tight"></h3>
                <p id="modal-description" className="text-gray-400 text-base leading-relaxed mb-6"></p>
                <div id="modal-tags" className="flex flex-wrap gap-2"></div>
            </div>
        </div>
    </div>
    <Script id="portfolio-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
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
    ` }} />
    <Script id="portfolio-1" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
        // --- PROJECT MODAL ---
        const modal = document.getElementById('project-modal');
        const modalImg = document.getElementById('modal-img');
        const modalImgWrap = document.getElementById('modal-img-wrap');
        const modalVisit = document.getElementById('modal-visit');
        const modalStrip = document.getElementById('modal-strip');
        let modalUrl = null;
        const modalBadge = document.getElementById('modal-badge');
        const modalCategory = document.getElementById('modal-category');
        const modalTitle = document.getElementById('modal-title');
        const modalDescription = document.getElementById('modal-description');
        const modalTags = document.getElementById('modal-tags');

        document.querySelectorAll('.portfolio-card').forEach(card => {
            card.addEventListener('click', () => {
                const accent = card.dataset.accent;
                modalImg.src = card.dataset.image;
                modalImg.alt = card.dataset.title;
                modalStrip.style.background = accent;
                modalBadge.style.cssText = \`background:\${accent}18; border:1px solid \${accent}33; color:\${accent}\`;
                modalBadge.innerHTML = \`<span style="width:6px;height:6px;border-radius:50%;background:\${accent};flex-shrink:0;display:inline-block"></span> \${card.dataset.badge}\`;
                modalCategory.style.color = accent;
                modalCategory.textContent = card.dataset.category;
                modalTitle.textContent = card.dataset.title;
                modalDescription.textContent = card.dataset.description;
                modalTags.innerHTML = card.dataset.tags.split('|').map(t =>
                    \`<span class="text-[10px] text-gray-400 bg-gray-800/80 px-3 py-1.5 rounded font-bold uppercase">\${t}</span>\`
                ).join('');
                modalUrl = card.dataset.url || null;
                if (modalUrl) {
                    modalImgWrap.style.cursor = 'pointer';
                    modalVisit.classList.remove('hidden');
                    modalVisit.classList.add('flex');
                } else {
                    modalImgWrap.style.cursor = '';
                    modalVisit.classList.add('hidden');
                    modalVisit.classList.remove('flex');
                }
                modal.classList.add('open');
                document.body.style.overflow = 'hidden';
            });
        });

        modalImgWrap.addEventListener('click', (e) => {
            if (e.target.closest('#modal-close')) return;
            if (modalUrl) window.open(modalUrl, '_blank', 'noopener,noreferrer');
        });

        function closeModal() {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
        document.getElementById('modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    ` }} />
    <Script id="portfolio-2" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `document.querySelector('.nav-link[href="/portfolio"]')?.classList.add('active');` }} />
<script dangerouslySetInnerHTML={{ __html: `document.querySelectorAll('[data-stop-propagation]').forEach(function (el) { el.addEventListener('click', function (e) { e.stopPropagation(); }); });` }} />
    </>
  );
}
