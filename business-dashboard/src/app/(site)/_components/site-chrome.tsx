/* eslint-disable @next/next/no-html-link-for-pages --
   Internal links are plain <a> on purpose. The ported marketing pages run their
   inline scripts once per full page load, so client-side navigation would leave
   their reveal animations and mobile menu uninitialised. */
import Script from "next/script";

/*
 * Nav, mobile menu, footer, and page behaviour for marketing pages added after
 * the Next.js port. The seven ported pages still carry their own copies of this
 * markup; change both until those pages move onto this component.
 */

const NAV = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/demo", label: "Demo" },
  { href: "/voice-receptionist", label: "Voice" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const BEHAVIOUR = `
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('active');
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  const hb1 = document.getElementById('hb1');
  const hb2 = document.getElementById('hb2');
  const hb3 = document.getElementById('hb3');
  let menuOpen = false;
  function setMenu(open) {
    menuOpen = open;
    mobileMenu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hb1.style.transform = open ? 'translateY(8px) rotate(45deg)' : '';
    hb2.style.opacity = open ? '0' : '1';
    hb3.style.transform = open ? 'translateY(-8px) rotate(-45deg)' : '';
    hb3.style.width = open ? '24px' : '';
  }
  hamburger.addEventListener('click', () => setMenu(!menuOpen));
  document.querySelectorAll('.mobile-link').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  document.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') ||
          href.startsWith('mailto') || href.startsWith('tel') ||
          link.target === '_blank' || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      document.body.classList.add('page-exit');
      setTimeout(() => { window.location.href = href; }, 300);
    });
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      document.body.classList.remove('page-exit');
      document.body.style.animation = 'pageIn 0.4s ease';
    }
  });
`;

export function SiteChrome({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <>
      <nav className="fixed top-0 w-full z-50 glass-nav h-20 flex items-center px-6 md:px-12 justify-between">
        <a href="/" className="flex items-center gap-3">
          <div className="pulsing-dot"></div>
          <span className="text-2xl font-extrabold tracking-tighter">Mindelo</span>
        </a>
        <div className="hidden md:flex gap-8 text-sm font-medium text-gray-400">
          {NAV.map((link) => (
            <a key={link.href} href={link.href} className={`nav-link hover:text-white${link.href === active ? " active" : ""}`}>
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <a href="/contact" className="bg-[#00e5b0] text-black px-6 py-2 rounded-full font-bold text-sm hover:scale-105 transition">Book a Consult</a>
          <button id="hamburger" className="md:hidden flex flex-col gap-1.5 p-2" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
            <span className="block w-6 h-0.5 bg-white transition-all duration-300" id="hb1"></span>
            <span className="block w-6 h-0.5 bg-white transition-all duration-300" id="hb2"></span>
            <span className="block w-4 h-0.5 bg-white transition-all duration-300" id="hb3"></span>
          </button>
        </div>
      </nav>

      <div id="mobile-menu" className="fixed top-20 left-0 w-full z-40 flex-col bg-[#0c1018] border-b border-gray-800 py-6 px-8 gap-5 text-base font-semibold text-gray-300">
        {NAV.map((link) => (
          <a key={link.href} href={link.href} className="mobile-link hover:text-white transition">{link.label}</a>
        ))}
      </div>

      {children}

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

      <Script id="site-chrome" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: BEHAVIOUR }} />
    </>
  );
}
