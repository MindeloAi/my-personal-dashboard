import type { Metadata } from "next";
import Script from "next/script";
import "../_styles/contact.css";

export const metadata: Metadata = {
    title: "Contact Mindelo | Custom Software in Trinidad & Tobago",
    description: "Get in touch with Mindelo for custom software in Trinidad and Tobago. Book a free 30-minute consult or call +1 (868) 361-2254.",
    alternates: {
      canonical: "/contact",
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "Contact Mindelo | Custom Software in Trinidad & Tobago",
      description: "Book a free 30-minute consult for custom software in Trinidad and Tobago. Call +1 (868) 361-2254.",
      url: "https://mindelo.site/contact",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Contact Mindelo | Custom Software in Trinidad & Tobago",
      description: "Book a free 30-minute consult for custom software in Trinidad and Tobago.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function ContactPage() {
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
              "name": "Contact",
              "item": "https://mindelo.site/contact"
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
    {/* ===== CONTACT ===== */}
    <section id="contact" className="py-32 px-6 md:px-12 max-w-7xl mx-auto grid md:grid-cols-2 gap-8 md:gap-16">
        <div className="reveal">
            <h2 className="text-3xl md:text-5xl heading-heavy mb-6">Let's Build Something <br /><span className="text-[#00e5b0]">Custom</span></h2>
            <p className="text-gray-400 mb-12">Got a problem the right software could solve? Reach out via the form or our direct office line.</p>

            <div className="space-y-4">
                <div className="p-6 bg-[#0c1018] rounded-2xl border border-gray-800 flex justify-between items-center group">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Direct Line</p>
                        <p className="text-xl font-black text-white group-hover:text-[#00e5b0] transition">+1 (868) 361-2254</p>
                    </div>
                    <img src="/assets/icons/direct-line.png" alt="" className="custom-icon contact-icon" aria-hidden="true" />
                </div>
                <div className="p-6 bg-[#0c1018] rounded-2xl border border-gray-800 flex justify-between items-center group">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Email Us</p>
                        <a href="mailto:admin@mindelo.site" className="text-xl font-black text-white group-hover:text-[#00e5b0] transition break-all">admin@mindelo.site</a>
                    </div>
                    <img src="/assets/icons/email-contact.png" alt="" className="custom-icon contact-icon" aria-hidden="true" />
                </div>
                <div className="p-6 bg-[#0c1018] rounded-2xl border border-gray-800 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Response Time</p>
                        <p className="text-xl font-black text-white">&lt; 2 Hours</p>
                    </div>
                    <img src="/assets/icons/response-time.png" alt="" className="custom-icon contact-icon" aria-hidden="true" />
                </div>
                <a href="https://www.instagram.com/mindelo_solutions/" target="_blank" rel="noopener noreferrer" className="p-6 bg-[#0c1018] rounded-2xl border border-gray-800 flex justify-between items-center group block hover:border-[#e1306c]/40 transition-colors">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Instagram</p>
                        <p className="text-xl font-black text-white group-hover:text-[#e1306c] transition">@mindelo_solutions</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#e1306c]/10 flex items-center justify-center text-[#e1306c]">
                        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width={20} height={20} rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
                    </div>
                </a>
                <a href="https://www.facebook.com/profile.php?id=61579117153959" target="_blank" rel="noopener noreferrer" className="p-6 bg-[#0c1018] rounded-2xl border border-gray-800 flex justify-between items-center group block hover:border-[#1877F2]/40 transition-colors">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Facebook</p>
                        <p className="text-xl font-black text-white group-hover:text-[#1877F2] transition">Mindelo</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center text-[#1877F2]">
                        <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                    </div>
                </a>
            </div>
        </div>

        <div className="bg-[#0c1018] p-6 md:p-10 rounded-3xl border border-gray-800 shadow-2xl reveal relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00e5b0] via-[#3b9eff] to-[#8b5cf6] rounded-t-3xl"></div>

            {/* Success message (hidden by default) */}
            <div id="form-success" className="hidden flex-col items-center justify-center text-center py-12 gap-4">
                <img src="/assets/icons/message-sent.png" alt="" className="custom-icon success-icon" aria-hidden="true" />
                <h3 className="text-xl font-bold">Message sent!</h3>
                <p className="text-gray-400 text-sm">We'll be in touch within 12 hours.</p>
            </div>

            {/* Contact form: handled by Netlify Forms (name="contact"). Submissions appear in
                 Netlify dashboard > Forms, and email notifications go to admin@mindelo.site.
                 NOTE: the notification recipient is set in the Netlify dashboard
                 (Forms > Form notifications), not in this markup. */}
            <form id="contact-form" name="contact" method="POST" action="/api/contact" className="space-y-4">
                
                <p className="hidden"><label>Leave this field empty: <input name="bot-field" /></label></p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" name="name" placeholder="Name" required className="w-full bg-black/40 border border-gray-800 rounded-xl px-5 py-4 outline-none focus:border-[#00e5b0] transition text-white placeholder-gray-600" />
                    <input type="email" name="email" placeholder="Email" required className="w-full bg-black/40 border border-gray-800 rounded-xl px-5 py-4 outline-none focus:border-[#00e5b0] transition text-white placeholder-gray-600" />
                </div>
                <select name="project_type" className="w-full border border-gray-800 rounded-xl px-5 py-4 outline-none focus:border-[#00e5b0] transition text-gray-400">
                    <option value="">Select Project Type</option>
                    <option value="Website or Web App">Website or Web App</option>
                    <option value="Business Dashboard">Business Dashboard</option>
                    <option value="Workflow Automation">Workflow Automation</option>
                    <option value="System Integration">System Integration</option>
                    <option value="Custom Software">Custom Software</option>
                    <option value="Not Sure Yet">Not Sure Yet</option>
                </select>
                <textarea name="message" placeholder="Tell us about your business goals..." rows={4} className="w-full bg-black/40 border border-gray-800 rounded-xl px-5 py-4 outline-none focus:border-[#00e5b0] transition text-white placeholder-gray-600 resize-none"></textarea>
                <button type="submit" className="w-full bg-[#00e5b0] text-black font-bold py-5 rounded-xl hover:brightness-110 transition shadow-[0_0_20px_rgba(0,229,176,0.2)]">
                    Start Your Project →
                </button>
            </form>
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
    <Script id="contact-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
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
    <Script id="contact-1" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
        // --- NETLIFY FORMS AJAX SUBMIT ---
        const form = document.getElementById('contact-form');
        const successMsg = document.getElementById('form-success');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="btn-spinner"></span> Sending…';
            try {
                const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(new FormData(form)).toString()
                });
                if (res.ok) {
                    form.classList.add('hidden');
                    successMsg.classList.remove('hidden');
                    successMsg.classList.add('flex');
                } else {
                    throw new Error('Server error');
                }
            } catch {
                btn.disabled = false;
                btn.innerHTML = originalText;
                if (!document.getElementById('form-error')) {
                    const err = document.createElement('p');
                    err.id = 'form-error';
                    err.className = 'text-red-400 text-sm text-center mt-2';
                    err.textContent = 'Something went wrong. Please try again.';
                    btn.after(err);
                }
            }
        });
    ` }} />
    <Script id="contact-2" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `document.querySelector('.nav-link[href="/contact"]')?.classList.add('active');` }} />

    </>
  );
}
