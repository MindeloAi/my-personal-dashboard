import type { Metadata } from "next";
import Script from "next/script";
import "../_styles/voice-receptionist.css";

export const metadata: Metadata = {
    title: "AI Voice Receptionist for Trinidad Businesses | Mindelo",
    description: "Mindelo's AI voice receptionist answers calls 24/7 for Trinidad and Tobago businesses, booking appointments, answering questions, and never missing a customer.",
    alternates: {
      canonical: "/voice-receptionist",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "AI Voice Receptionist for Trinidad Businesses | Mindelo",
      description: "An AI voice receptionist that answers calls 24/7 for Trinidad and Tobago businesses, booking appointments and never missing a customer.",
      url: "https://mindelo.site/voice-receptionist",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "AI Voice Receptionist for Trinidad Businesses | Mindelo",
      description: "An AI voice receptionist that answers calls 24/7 for Trinidad & Tobago businesses.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function VoiceReceptionistPage() {
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
              "name": "Voice Receptionist",
              "item": "https://mindelo.site/voice-receptionist"
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

    {/* ===== VOICE DEMO ===== */}
    <section id="voice-demo" className="py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
            <div className="mb-16 reveal text-center">
                <span className="text-[#00e5b0] text-sm font-bold uppercase tracking-widest">Voice Demo</span>
                <h2 className="text-5xl heading-heavy mt-2">Call Rick, our voice receptionist</h2>
                <p className="text-gray-500 mt-3 text-sm max-w-xl mx-auto">Rick is a live AI phone agent, built on the same technology we deploy for clients. He answers calls, books appointments, and captures messages, naturally and around the clock. Give him a call and hear it for yourself.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-start">
                {/* Left: call card */}
                <div className="reveal">
                    <div className="bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden" style={{boxShadow: "0 0 60px rgba(0,229,176,0.06)"}}>
                        {/* Card header */}
                        <div className="bg-[#0a0e16] border-b border-gray-800 px-5 py-4 flex items-center gap-3">
                            <img src="/assets/icons/phone-voice.png" alt="" className="custom-icon" style={{width: "32px", height: "32px"}} aria-hidden="true" />
                            <div>
                                <div className="font-bold" style={{fontSize: "14px"}}>Rick</div>
                                <div className="flex items-center gap-2 text-gray-500" style={{fontSize: "11px"}}>
                                    <span className="w-2 h-2 rounded-full bg-[#00e5b0]" style={{boxShadow: "0 0 6px #00e5b0"}}></span>
                                    Online, answers 24/7
                                </div>
                            </div>
                            <span className="ml-auto text-[10px] text-gray-600 font-bold uppercase tracking-widest">Mindelo</span>
                        </div>

                        {/* Card body */}
                        <div className="px-6 py-8">
                            <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-3 text-center">Tap to call</p>
                            <a href="tel:+15615661246" className="call-cta">
                                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                +1 (561) 566-1246
                            </a>
                            <p className="text-center text-gray-600 text-[11px] mt-3">Standard call rates may apply. No signup, just dial.</p>

                            <div className="mt-8 pt-6 border-t border-gray-800">
                                <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-4">What to expect</p>
                                <ul className="space-y-3 text-sm text-gray-400">
                                    <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-[#00e5b0] mt-1.5 flex-shrink-0" style={{boxShadow: "0 0 6px #00e5b0"}}></span> Talk to Rick naturally, just like a real receptionist.</li>
                                    <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-[#3b9eff] mt-1.5 flex-shrink-0" style={{boxShadow: "0 0 6px #3b9eff"}}></span> Ask about our services, hours, or how we work.</li>
                                    <li className="flex items-start gap-3"><span className="w-2 h-2 rounded-full bg-[#8b5cf6] mt-1.5 flex-shrink-0" style={{boxShadow: "0 0 6px #8b5cf6"}}></span> He can book you a free consultation and pass your details to the team.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mt-8 mb-3">Try asking Rick</p>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className="voice-chip">What does Mindelo do?</button>
                        <button type="button" className="voice-chip">Can I book a consultation?</button>
                        <button type="button" className="voice-chip">What are your hours?</button>
                        <button type="button" className="voice-chip">Do you build voice agents like you?</button>
                    </div>

                    {/* Outbound demo: the AI calls the visitor */}
                    <a href="https://mindelo-demo.vercel.app" target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center justify-between gap-4 bg-[#0c1018] border border-[#3b9eff]/40 rounded-2xl px-5 py-4 hover:border-[#3b9eff] transition group">
                        <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#3b9eff]" style={{boxShadow: "0 0 6px #3b9eff"}}></span>
                                Prefer we call you?
                            </div>
                            <div className="text-gray-500 text-xs mt-1">Enter your number and our AI rings you back in seconds.</div>
                        </div>
                        <span className="text-[#3b9eff] font-bold text-sm whitespace-nowrap group-hover:translate-x-0.5 transition">Get a call →</span>
                    </a>
                </div>

                {/* Right: sample call transcript */}
                <div className="reveal delay-200">
                    <div className="bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden" style={{boxShadow: "0 0 60px rgba(0,229,176,0.06)"}}>
                        {/* Panel header */}
                        <div className="bg-[#0a0e16] border-b border-gray-800 px-5 py-4 flex items-center gap-3">
                            <img src="/assets/icons/phone-voice.png" alt="" className="custom-icon" style={{width: "32px", height: "32px"}} aria-hidden="true" />
                            <div>
                                <div className="font-bold" style={{fontSize: "14px"}}>Rick</div>
                                <div className="text-gray-500" style={{fontSize: "11px"}}>Sample call</div>
                            </div>
                            <span className="ml-auto text-[10px] text-gray-600 font-bold uppercase tracking-widest">Transcript</span>
                        </div>
                        {/* Transcript */}
                        <div style={{padding: "16px", display: "flex", flexDirection: "column", gap: "10px"}}>
                            <div className="vt-msg bot"><div className="vt-bubble">Thanks for calling Mindelo AI, this is Rick. How can I help you today?</div></div>
                            <div className="vt-msg user"><div className="vt-bubble">Hi, what kind of work do you guys do?</div></div>
                            <div className="vt-msg bot"><div className="vt-bubble">We build custom AI tools for businesses: website chatbots, voice receptionists like me, and workflow automations. Are you looking for something in particular?</div></div>
                            <div className="vt-msg user"><div className="vt-bubble">Maybe a chatbot for my site. Can I talk to someone?</div></div>
                            <div className="vt-msg bot"><div className="vt-bubble">Absolutely. I can set you up with a free consultation. What's the best name and number to reach you?</div></div>
                            <div className="vt-msg user"><div className="vt-bubble">Sure, it's Andre, 868-555-0142.</div></div>
                            <div className="vt-msg bot"><div className="vt-bubble">Got it, Andre, 868-555-0142. Someone from the team will reach out shortly. Anything else I can help with?</div></div>
                        </div>
                    </div>
                    <p className="text-center text-gray-600 text-[11px] mt-4">Illustrative transcript. Call Rick to hear the real thing.</p>
                </div>
            </div>
        </div>
    </section>

    {/* ===== CLIENT DASHBOARD ===== */}
    <section id="dashboard" className="py-32 px-6 md:px-12 border-t border-gray-900">
        <div className="max-w-5xl mx-auto">
            <div className="mb-16 reveal text-center">
                <span className="text-[#00e5b0] text-sm font-bold uppercase tracking-widest">Your Dashboard</span>
                <h2 className="text-4xl md:text-5xl heading-heavy mt-2">Every call, captured and organized</h2>
                <p className="text-gray-500 mt-3 text-sm max-w-2xl mx-auto">Your receptionist doesn't just answer the phone, it feeds a live dashboard built just for you. Every call comes back as a full transcript, an AI summary, and any bookings or messages, so nothing slips through the cracks while you're busy.</p>
            </div>

            {/* Framed dashboard mockup */}
            <div className="reveal delay-100 rounded-2xl overflow-hidden border border-white/5 bg-[#0c1018]" style={{boxShadow: "0 0 55px rgba(0,229,176,0.12)"}}>
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#0a0e16] border-b border-gray-800">
                    <span className="w-3 h-3 rounded-full" style={{background: "#ff5f57"}}></span>
                    <span className="w-3 h-3 rounded-full" style={{background: "#febc2e"}}></span>
                    <span className="w-3 h-3 rounded-full" style={{background: "#28c840"}}></span>
                    <div className="flex-1 flex justify-center">
                        <div className="bg-[#06090d] border border-gray-800 rounded-md px-3 py-1 text-[11px] text-gray-500 max-w-xs w-full text-center truncate">app.mindelo.site/dashboard</div>
                    </div>
                </div>

                {/* Dashboard body */}
                <div className="p-5 md:p-6">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <div className="font-bold text-white text-lg">Calls</div>
                            <div className="text-gray-500 text-xs">Live and recent calls handled by your receptionist.</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-[#00e5b0]" style={{boxShadow: "0 0 6px #00e5b0"}}></span> Live
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        <div className="bg-[#0a0e16] border border-gray-800 rounded-xl p-3">
                            <div className="text-[10px] uppercase tracking-widest text-gray-600 font-bold">Calls today</div>
                            <div className="text-2xl font-extrabold text-white mt-1">12</div>
                        </div>
                        <div className="bg-[#0a0e16] border border-gray-800 rounded-xl p-3">
                            <div className="text-[10px] uppercase tracking-widest text-gray-600 font-bold">This week</div>
                            <div className="text-2xl font-extrabold text-white mt-1">68</div>
                        </div>
                        <div className="bg-[#0a0e16] border border-gray-800 rounded-xl p-3">
                            <div className="text-[10px] uppercase tracking-widest text-gray-600 font-bold">Avg. duration</div>
                            <div className="text-2xl font-extrabold text-white mt-1">2m 18s</div>
                        </div>
                        <div className="bg-[#0a0e16] border border-gray-800 rounded-xl p-3">
                            <div className="text-[10px] uppercase tracking-widest text-gray-600 font-bold">Bookings</div>
                            <div className="text-2xl font-extrabold text-white mt-1">7</div>
                        </div>
                    </div>

                    {/* Calls list + detail */}
                    <div className="grid lg:grid-cols-5 gap-4">
                        {/* Recent calls list */}
                        <div className="lg:col-span-2 bg-[#0a0e16] border border-gray-800 rounded-xl overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-gray-800 text-[10px] uppercase tracking-widest text-gray-600 font-bold">Recent calls</div>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-900 bg-[#0c1320]">
                                <div>
                                    <div className="text-sm text-white font-semibold">+1 (868) 555-0142</div>
                                    <div className="text-[11px] text-gray-500">Today, 10:24 AM &middot; 2m 41s</div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00e5b0]/15 text-[#00e5b0] whitespace-nowrap">Booked</span>
                            </div>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-900">
                                <div>
                                    <div className="text-sm text-gray-300 font-semibold">+1 (868) 555-0198</div>
                                    <div className="text-[11px] text-gray-500">Today, 9:51 AM &middot; 1m 12s</div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#3b9eff]/15 text-[#3b9eff] whitespace-nowrap">Message</span>
                            </div>
                            <div className="flex items-center justify-between px-4 py-3">
                                <div>
                                    <div className="text-sm text-gray-300 font-semibold">+1 (868) 555-0173</div>
                                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#00e5b0]" style={{boxShadow: "0 0 5px #00e5b0"}}></span> In progress</div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-700/40 text-gray-400 whitespace-nowrap">Live</span>
                            </div>
                        </div>

                        {/* Call detail */}
                        <div className="lg:col-span-3 bg-[#0a0e16] border border-gray-800 rounded-xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-white font-semibold">+1 (868) 555-0142</div>
                                    <div className="text-[11px] text-gray-500">Today, 10:24 AM &middot; 2m 41s &middot; Completed</div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00e5b0]/15 text-[#00e5b0] whitespace-nowrap">Booked</span>
                            </div>

                            {/* AI summary */}
                            <div className="rounded-lg border border-gray-800 p-3 bg-[#06090d]">
                                <div className="flex items-center gap-2 mb-1.5 text-[10px] uppercase tracking-widest font-bold text-[#3b9eff]"><span className="w-2 h-2 rounded-full bg-[#3b9eff]" style={{boxShadow: "0 0 6px #3b9eff"}}></span> AI Summary</div>
                                <p className="text-[12.5px] text-gray-400 leading-relaxed">Caller asked for a quote on kitchen cabinets and booked an on-site measurement. Mentioned a preference for soft-close hinges and a mid-June timeline.</p>
                            </div>

                            {/* Appointment */}
                            <div className="rounded-lg border border-gray-800 p-3 bg-[#06090d] flex items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1 text-[10px] uppercase tracking-widest font-bold text-[#8b5cf6]"><span className="w-2 h-2 rounded-full bg-[#8b5cf6]" style={{boxShadow: "0 0 6px #8b5cf6"}}></span> Appointment</div>
                                    <div className="text-[13px] text-white font-semibold">Thursday, 2:00 PM</div>
                                    <div className="text-[11px] text-gray-500">On-site consultation</div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8b5cf6]/15 text-[#8b5cf6] whitespace-nowrap">Confirmed</span>
                            </div>

                            {/* Transcript snippet */}
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-widest font-bold text-[#00e5b0]"><span className="w-2 h-2 rounded-full bg-[#00e5b0]" style={{boxShadow: "0 0 6px #00e5b0"}}></span> Transcript</div>
                                <div style={{display: "flex", flexDirection: "column", gap: "8px"}}>
                                    <div className="vt-msg bot"><div className="vt-bubble">Thanks for calling. How can I help you today?</div></div>
                                    <div className="vt-msg user"><div className="vt-bubble">I'd like a quote for kitchen cabinets.</div></div>
                                    <div className="vt-msg bot"><div className="vt-bubble">Happy to help. I can book an on-site measurement, does Thursday at 2 work?</div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <p className="text-center text-gray-600 text-[11px] mt-4">Illustrative dashboard. Every client gets their own secure login.</p>

            {/* Feature callouts */}
            <div className="grid md:grid-cols-3 gap-6 mt-12 reveal delay-200">
                <div className="bg-[#0c1018] border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-[#00e5b0]" style={{boxShadow: "0 0 6px #00e5b0"}}></span><span className="font-bold text-white text-sm">Transcripts</span></div>
                    <p className="text-gray-500 text-[13px] leading-relaxed">Every conversation recorded word for word, so you always know exactly what was said.</p>
                </div>
                <div className="bg-[#0c1018] border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-[#3b9eff]" style={{boxShadow: "0 0 6px #3b9eff"}}></span><span className="font-bold text-white text-sm">AI Summaries</span></div>
                    <p className="text-gray-500 text-[13px] leading-relaxed">The key points and intent of each call, distilled to a glance, no need to listen back.</p>
                </div>
                <div className="bg-[#0c1018] border border-gray-800 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full bg-[#8b5cf6]" style={{boxShadow: "0 0 6px #8b5cf6"}}></span><span className="font-bold text-white text-sm">Bookings</span></div>
                    <p className="text-gray-500 text-[13px] leading-relaxed">Appointments and callbacks captured automatically and ready for you to confirm.</p>
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
    <Script id="voice-receptionist-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
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
    <Script id="voice-receptionist-1" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `document.querySelector('.nav-link[href="/voice-receptionist"]')?.classList.add('active');` }} />

    </>
  );
}
