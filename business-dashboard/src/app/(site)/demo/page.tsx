import type { Metadata } from "next";
import Script from "next/script";
import "../_styles/demo.css";

export const metadata: Metadata = {
    title: "Live Demos: Custom Software in Action | Mindelo Trinidad",
    description: "Try interactive demos of the custom software Mindelo builds for Trinidad and Tobago and Caribbean businesses: job tracking, quote follow-up, and more.",
    alternates: {
      canonical: "/demo",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "Live Demos: Custom Software in Action | Mindelo Trinidad",
      description: "Interactive demos of the custom software Mindelo builds for Trinidad and Tobago and Caribbean businesses.",
      url: "https://mindelo.site/demo",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Live Demos: Custom Software in Action | Mindelo Trinidad",
      description: "Interactive demos of the custom software Mindelo builds for Trinidad and Tobago and Caribbean businesses.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function DemoPage() {
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
              "name": "Demos",
              "item": "https://mindelo.site/demo"
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
    {/* ===== DEMO ===== */}
    <section id="demo" className="py-32 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
            <div className="mb-16 reveal text-center">
                <span className="text-[#00e5b0] text-sm font-bold uppercase tracking-widest">Interactive Demo</span>
                <h2 className="text-5xl heading-heavy mt-2">See It in Action</h2>
                <p className="text-gray-500 mt-3 text-sm max-w-lg mx-auto">Chat with Sophie, our assistant, built on the same technology we put to work for clients. Ask her anything about what we do.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-start">
                {/* Left: info + chips */}
                <div className="reveal">
                    <div className="space-y-4 mb-8">
                        <p className="text-gray-400 leading-relaxed">Sophie is a live example of a customer-facing assistant we built. She answers questions about Mindelo's services, responds naturally, and can guide you toward booking a call.</p>
                        <p className="text-gray-500 text-sm leading-relaxed">This is the same kind of tool we build for our clients, customised to their brand, knowledge base, and goals.</p>
                    </div>

                    <p className="text-[10px] text-gray-600 uppercase font-bold tracking-widest mb-3">Try asking:</p>
                    <div className="flex flex-wrap gap-2 mb-10" id="demo-chips">
                        <button className="demo-chip">What services do you offer?</button>
                        <button className="demo-chip">How quickly can you build this?</button>
                        <button className="demo-chip">What does a project cost?</button>
                        <button className="demo-chip">Can you integrate with my CRM?</button>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-2 h-2 rounded-full bg-[#00e5b0]" style={{boxShadow: "0 0 6px #00e5b0"}}></div>
                        Sophie is live. Type in the panel to start
                    </div>
                </div>

                {/* Right: real embedded chat */}
                <div className="reveal delay-200">
                    <div id="demo-chat-panel" className="bg-[#0c1018] border border-gray-800 rounded-3xl overflow-hidden" style={{boxShadow: "0 0 60px rgba(0,229,176,0.06)", position: "relative"}}>
                        {/* Panel header */}
                        <div className="bg-[#0a0e16] border-b border-gray-800 px-5 py-4 flex items-center gap-3">
                            <div className="aria-avatar" style={{width: "32px", height: "32px", fontSize: "13px"}}><img src="/assets/icons/sophie-assistant.png" alt="" className="custom-icon chat-avatar-icon" aria-hidden="true" /></div>
                            <div>
                                <div className="aria-name" style={{fontSize: "13px"}}>Sophie</div>
                                <div className="aria-status" style={{fontSize: "10px"}}>Online, responds instantly</div>
                            </div>
                            <span className="chat-header-label">Mindelo</span>
                        </div>
                        {/* Messages */}
                        <div id="demo-chat-messages" style={{height: "320px", overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", scrollbarWidth: "thin", scrollbarColor: "#1f2937 transparent"}}>
                            <div className="chat-msg bot">
                                <div className="chat-bubble">Hey! I'm Sophie, Mindelo's assistant. <img src="/assets/icons/wave-hello.png" alt="" className="custom-icon inline-hello-icon" aria-hidden="true" /><br /><br />Ask me anything about what we build: websites, dashboards, integrations, automations, and more.</div>
                            </div>
                        </div>
                        {/* Locked overlay (visible when floating chat is open) */}
                        <div id="demo-locked-overlay" style={{display: "none", position: "absolute", inset: "0", background: "rgba(6,9,13,0.82)", backdropFilter: "blur(4px)", borderRadius: "24px", zIndex: "5", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "6px", textAlign: "center", padding: "24px"}}>
                            <p style={{color: "#9ca3af", fontSize: "13px", fontWeight: "600"}}>Chat widget is open</p>
                            <p style={{color: "#6b7280", fontSize: "12px"}}>Close the widget at the bottom-right to use this demo</p>
                        </div>
                        {/* Input bar */}
                        <div className="bg-[#0a0e16] border-t border-gray-800 px-4 py-3 flex items-center gap-3">
                            <input id="demo-chat-input" type="text" placeholder="Ask Sophie anything..." autoComplete="off" maxLength={500} style={{flex: "1", background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "10px 14px", color: "#f3f4f6", fontSize: "13.5px", fontFamily: "inherit", outline: "none", transition: "border-color 0.2s,opacity 0.2s"}} />
                            <button id="demo-chat-send" style={{width: "38px", height: "38px", borderRadius: "10px", background: "#00e5b0", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0", transition: "all 0.2s"}}>
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                            </button>
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
                <a href="/portfolio/websites" className="text-gray-500 hover:text-white transition">Websites</a>
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
    <Script id="demo-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
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
    <Script id="demo-1" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `document.querySelector('.nav-link[href="/demo"]')?.classList.add('active');` }} />
    <Script id="demo-2" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
        (function (f) { f(); })(function () {
            const WEBHOOK_URL = '/api/chat';

            const demoMessages = document.getElementById('demo-chat-messages');
            const demoInput    = document.getElementById('demo-chat-input');
            const demoSendBtn  = document.getElementById('demo-chat-send');
            const demoOverlay  = document.getElementById('demo-locked-overlay');

            if (!demoMessages || !demoInput || !demoSendBtn) return;

            let demoIsBusy  = false;
            let demoHistory = [];

            // ---- HELPERS ----
            function appendMsg(container, text, role) {
                const wrap = document.createElement('div');
                wrap.className = 'chat-msg ' + role;
                const bubble = document.createElement('div');
                bubble.className = 'chat-bubble';
                bubble.innerHTML = text.replace(/\\n/g, '<br>');
                wrap.appendChild(bubble);
                container.appendChild(wrap);
                container.scrollTop = container.scrollHeight;
            }
            function showTyping(container, id) {
                const wrap = document.createElement('div');
                wrap.className = 'chat-msg bot';
                wrap.id = id;
                wrap.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
                container.appendChild(wrap);
                container.scrollTop = container.scrollHeight;
            }
            function hideTyping(id) {
                const t = document.getElementById(id);
                if (t) t.remove();
            }

            // ---- LOCK / UNLOCK DEMO ----
            function lockDemo() {
                demoInput.disabled = true;
                demoSendBtn.disabled = true;
                demoInput.style.opacity = '0.4';
                demoSendBtn.style.opacity = '0.3';
                demoSendBtn.style.cursor = 'not-allowed';
                if (demoOverlay) { demoOverlay.style.display = 'flex'; }
            }
            function unlockDemo() {
                if (demoIsBusy) return;
                demoInput.disabled = false;
                demoSendBtn.disabled = false;
                demoInput.style.opacity = '';
                demoSendBtn.style.opacity = '';
                demoSendBtn.style.cursor = 'pointer';
                if (demoOverlay) { demoOverlay.style.display = 'none'; }
            }

            // Register hooks so widget.js can lock/unlock the demo panel
            window._sophieWidgetOnOpen  = lockDemo;
            window._sophieWidgetOnClose = unlockDemo;

            // ---- DEMO SEND ----
            async function demoSend() {
                const floatIsOpen = window._sophieWidget && window._sophieWidget.isOpen();
                const text = demoInput.value.trim();
                if (!text || demoIsBusy || floatIsOpen) return;
                demoInput.value = '';
                demoIsBusy = true;
                demoInput.disabled = true;
                demoSendBtn.disabled = true;
                appendMsg(demoMessages, text, 'user');
                showTyping(demoMessages, 'demo-typing');
                try {
                    const res = await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text, history: demoHistory.slice(-8) })
                    });
                    let reply = "Sorry, I didn't catch that. Try again!";
                    try { const data = await res.json(); if (data && data.reply) reply = data.reply; } catch (e) {}
                    hideTyping('demo-typing');
                    appendMsg(demoMessages, reply, 'bot');
                    demoHistory.push({ role: 'user', content: text });
                    demoHistory.push({ role: 'assistant', content: reply });
                } catch (err) {
                    hideTyping('demo-typing');
                    appendMsg(demoMessages, 'Something went wrong. Please try again in a moment.', 'bot');
                } finally {
                    demoIsBusy = false;
                    const stillOpen = window._sophieWidget && window._sophieWidget.isOpen();
                    if (stillOpen) {
                        lockDemo();
                    } else {
                        demoInput.disabled = false;
                        demoSendBtn.disabled = false;
                        demoInput.style.opacity = '';
                        demoSendBtn.style.opacity = '';
                        demoSendBtn.style.cursor = 'pointer';
                        demoInput.focus();
                    }
                }
            }
            demoSendBtn.addEventListener('click', demoSend);
            demoInput.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); demoSend(); } });

            // ---- CHIPS → fill demo input only ----
            document.querySelectorAll('.demo-chip').forEach(function (chip) {
                chip.addEventListener('click', function () {
                    const floatIsOpen = window._sophieWidget && window._sophieWidget.isOpen();
                    if (floatIsOpen) return;
                    demoInput.value = chip.textContent.trim();
                    demoInput.focus();
                });
            });
        });
    ` }} />

    </>
  );
}
