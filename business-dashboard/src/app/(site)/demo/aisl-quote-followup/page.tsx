import type { Metadata } from "next";
import Script from "next/script";
import "../../_styles/demo-aisl-quote-followup.css";

export const metadata: Metadata = {
    title: "AISL · Quote Follow-up System · Demo | Mindelo",
    description: "Interactive demo of the automated quote follow-up system Mindelo built for Accurate Industrial Supplies: quote pipeline, automation timeline, and live metrics.",
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "AISL Quote Follow-up System · Demo | Mindelo",
      description: "Interactive demo of the automated quote follow-up system Mindelo built for Accurate Industrial Supplies.",
      url: "https://mindelo.site/demo/aisl-quote-followup",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "AISL Quote Follow-up System · Demo | Mindelo",
      description: "Interactive demo of the automated quote follow-up system Mindelo built for Accurate Industrial Supplies.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function AislQuoteFollowupDemoPage() {
  return (
    <>
      
      
    {/* ===== TOP BAR ===== */}
    <header className="demo-topbar">
        <a href="/" className="back-link" id="backLink">&larr; Back to Mindelo</a>
        <span className="demo-label">AISL &middot; <b>Quote Follow-up System</b> &middot; Demo</span>
        <span className="topbar-spacer"></span>
    </header>

    {/* ===== WORKSPACE ===== */}
    <main className="workspace">
        {/* LEFT: Quote pipeline */}
        <section className="panel">
            <div className="panel-title">Active Quotes &middot; <b id="activeCount">7</b></div>
            <div className="quote-list" id="quoteList"></div>
        </section>

        {/* CENTER: Detail + automation timeline */}
        <section className="panel">
            <div className="detail-head">
                <div>
                    <div className="detail-customer" id="dCustomer">—</div>
                    <div className="detail-sub" id="dSub">—</div>
                </div>
                <span className="badge" id="dBadge"></span>
            </div>

            <table className="items">
                <thead>
                    <tr><th>Item</th><th className="num">Qty</th><th>Unit</th><th className="num">Price</th><th className="num">Total</th></tr>
                </thead>
                <tbody id="dItems"></tbody>
            </table>
            <div className="items-total"><span className="lbl">Quote total</span><span className="amt" id="dTotal">—</span></div>

            <div className="email-preview" id="emailPreview">
                <div className="from" id="emailFrom">From: quotes@accurateindustrial.tt</div>
                <div id="emailBody"></div>
            </div>

            <div className="timeline-head">Automation Timeline</div>
            <ul className="tl" id="timeline"></ul>

            <button className="sim-btn" id="simBtn">&#9654; Simulate next automation step</button>
            <div className="sim-done-note" id="simDoneNote">All automation steps complete for this quote.</div>
        </section>

        {/* RIGHT: Live metrics */}
        <aside className="panel">
            <div className="panel-title">Live Metrics</div>
            <div className="metric">
                <div className="m-lbl">Quote &rarr; Order Conversion</div>
                <div className="m-val teal">34%</div>
                <div className="m-delta">&uarr; +11% vs. last quarter</div>
            </div>
            <div className="metric">
                <div className="m-lbl">Avg. response time after follow-up</div>
                <div className="m-val">1.4 <span style={{fontSize: "0.9rem", color: "#9ca3af"}}>days</span></div>
            </div>
            <div className="metric">
                <div className="m-lbl">Quotes followed up automatically this month</div>
                <div className="m-val" id="mFollowups">28</div>
            </div>
            <div className="metric">
                <div className="m-lbl">Estimated revenue recovered</div>
                <div className="m-val teal">TTD 47,200</div>
            </div>
            <div className="metric">
                <div className="m-lbl">Manual follow-up hours saved / week</div>
                <div className="m-val">6.5 <span style={{fontSize: "0.9rem", color: "#9ca3af"}}>hrs</span></div>
            </div>
        </aside>
    </main>

    {/* ===== DEMO FOOTER ===== */}
    <footer className="demo-foot">
        <p className="credit">Built for Accurate Industrial Supplies Ltd &middot; Live in production since 2025. Numbers shown are illustrative for demo purposes.</p>
        <a href="/contact" className="consult-cta">Want this for your business? Book a free consult &rarr;</a>
    </footer>

    {/* ===== FLOATING DEMO PILL ===== */}
    <div className="demo-pill"><span className="pulse-dot"></span> Demo &middot; Live data is illustrative</div>

    <Script id="demo-aisl-quote-followup-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
    /* =========================================================================
       HARDCODED DUMMY DATA — nothing here is real or persisted.
       Customers are drawn only from Mindelo's existing client roster.
       Refreshing the page resets everything to this initial state.
       ========================================================================= */
    const STATUS_TEXT = {
        awaiting: 'Awaiting reply',
        followup: 'Follow-up sent',
        replied:  'Replied',
        won:      'Won',
        lost:     'Lost'
    };

    // Each quote carries its own automation timeline. Steps with done:false are
    // "pending" and get advanced one at a time by the Simulate button.
    const QUOTES = [
        {
            id: 'Q-2026-0142', customer: 'Petrotrin Refinery', value: 12480,
            sent: 'Sent today', status: 'awaiting',
            items: [
                ['Durlon 8500 Gasket 6"', 4, 'ea', 1420, 5680],
                ['Chemstar Style 1625 Packing', 2, 'kg', 880, 1760],
                ['Carbon Steel Stud Bolts 3/4"', 40, 'ea', 38, 1520],
                ['Spiral Wound Gasket Kit', 6, 'set', 586.67, 3520]
            ],
            timeline: [
                { when: 'Day 0 · 09:14', type: 'send', label: 'Quote generated and emailed to customer', done: true },
                { when: 'Day 2 · 09:14', type: 'loop', label: 'Automated follow-up #1 sent', done: false,
                  email: 'Hi Petrotrin Refinery team, just checking if you had a chance to review the quote we sent on the Durlon gaskets and packing. Happy to walk through any line item — let me know what works.' },
                { when: 'Day 5 · 09:14', type: 'loop', label: 'Automated follow-up #2 sent', done: false,
                  email: 'Following up once more — happy to adjust quantities or specs if needed. We can also hold current pricing through month-end if that helps you plan.' },
                { when: 'Day 6 · 14:32', type: 'check', label: 'Customer replied. Logged in CRM. Conversion tracked.', done: false }
            ]
        },
        {
            id: 'Q-2026-0138', customer: 'Methanex T&T', value: 8940,
            sent: 'Sent 2 days ago', status: 'followup',
            items: [
                ['Industrial Floor Sealant 20L', 6, 'pail', 940, 5640],
                ['Safety Signage Pack', 1, 'set', 1300, 1300],
                ['Nitrile Gloves (Case)', 8, 'box', 250, 2000]
            ],
            timeline: [
                { when: 'Day 0 · 10:02', type: 'send', label: 'Quote generated and emailed to customer', done: true },
                { when: 'Day 2 · 10:02', type: 'loop', label: 'Automated follow-up #1 sent', done: true,
                  email: 'Hi Methanex T&T, just checking if you had a chance to review the quote for the floor sealant and safety pack. Happy to adjust quantities for your plant.' },
                { when: 'Day 5 · 10:02', type: 'loop', label: 'Automated follow-up #2 sent', done: false,
                  email: 'Following up once more — happy to adjust quantities or specs if needed. We can split delivery across your units at no extra charge.' },
                { when: 'Day 6 · 11:20', type: 'check', label: 'Customer replied. Logged in CRM. Conversion tracked.', done: false }
            ]
        },
        {
            id: 'Q-2026-0151', customer: 'Atlantic LNG', value: 21360,
            sent: 'Sent 6 days ago', status: 'replied',
            items: [
                ['Pump Mechanical Seal 3"', 12, 'ea', 740, 8880],
                ['Hydraulic Hose Assembly', 4, 'ea', 1620, 6480],
                ['Lubricant Drum 200L', 2, 'drum', 3000, 6000]
            ],
            timeline: [
                { when: 'Day 0 · 08:40', type: 'send', label: 'Quote generated and emailed to customer', done: true },
                { when: 'Day 2 · 08:40', type: 'loop', label: 'Automated follow-up #1 sent', done: true,
                  email: 'Hi Atlantic LNG team, just checking if you had a chance to review the quote on the pump seals and hose assemblies.' },
                { when: 'Day 5 · 08:40', type: 'loop', label: 'Automated follow-up #2 sent', done: true,
                  email: 'Following up once more — happy to adjust quantities or specs if needed. We have stock on the seals now.' },
                { when: 'Day 6 · 14:32', type: 'check', label: 'Customer replied. Logged in CRM. Conversion tracked.', done: true }
            ]
        },
        {
            id: 'Q-2026-0129', customer: 'Republic Bank Facilities', value: 4180,
            sent: 'Sent 9 days ago', status: 'won',
            items: [
                ['Office Fire Extinguisher 9kg', 4, 'ea', 620, 2480],
                ['First Aid Station Refill', 2, 'set', 850, 1700]
            ],
            timeline: [
                { when: 'Day 0 · 13:15', type: 'send', label: 'Quote generated and emailed to customer', done: true },
                { when: 'Day 2 · 13:15', type: 'loop', label: 'Automated follow-up #1 sent', done: true,
                  email: 'Hi Republic Bank Facilities, just checking if you had a chance to review the safety equipment quote.' },
                { when: 'Day 4 · 09:50', type: 'check', label: 'Customer replied and confirmed the order. Marked Won.', done: true }
            ]
        },
        {
            id: 'Q-2026-0133', customer: 'National Gas Company', value: 6720,
            sent: 'Sent 4 days ago', status: 'awaiting',
            items: [
                ['Submersible Sump Pump 1HP', 2, 'ea', 2100, 4200],
                ['PVC Pressure Pipe 4"', 12, 'len', 145, 1740],
                ['Pipe Fitting Assortment', 1, 'box', 780, 780]
            ],
            timeline: [
                { when: 'Day 0 · 15:30', type: 'send', label: 'Quote generated and emailed to customer', done: true },
                { when: 'Day 2 · 15:30', type: 'loop', label: 'Automated follow-up #1 sent', done: false,
                  email: 'Hi National Gas Company, just checking if you had a chance to review the quote on the sump pumps and piping for the station works.' },
                { when: 'Day 5 · 15:30', type: 'loop', label: 'Automated follow-up #2 sent', done: false,
                  email: 'Following up once more — happy to adjust quantities or specs if needed. We can deliver to site this week.' },
                { when: 'Day 6 · 10:05', type: 'check', label: 'Customer replied. Logged in CRM. Conversion tracked.', done: false }
            ]
        },
        {
            id: 'Q-2026-0147', customer: 'Phoenix Park Gas Processors', value: 33150,
            sent: 'Sent 3 days ago', status: 'followup',
            items: [
                ['Globe Valve 3" Flanged', 6, 'ea', 2480, 14880],
                ['Pressure Gauge 0-600 PSI', 10, 'ea', 415, 4150],
                ['Welding Rod E7018 (Case)', 8, 'box', 1015, 8120],
                ['Flange Gasket Set', 10, 'set', 600, 6000]
            ],
            timeline: [
                { when: 'Day 0 · 07:55', type: 'send', label: 'Quote generated and emailed to customer', done: true },
                { when: 'Day 2 · 07:55', type: 'loop', label: 'Automated follow-up #1 sent', done: true,
                  email: 'Hi Phoenix Park Gas Processors, just checking if you had a chance to review the valve and gauge quote for the plant shutdown.' },
                { when: 'Day 5 · 07:55', type: 'loop', label: 'Automated follow-up #2 sent', done: false,
                  email: 'Following up once more — happy to adjust quantities or specs if needed. We can prioritise the globe valves to meet your shutdown window.' },
                { when: 'Day 6 · 16:10', type: 'check', label: 'Customer replied. Logged in CRM. Conversion tracked.', done: false }
            ]
        },
        {
            id: 'Q-2026-0118', customer: 'Trinidad Cement Ltd', value: 2960,
            sent: 'Sent 16 days ago', status: 'lost',
            items: [
                ['Conveyor Belt 800mm', 30, 'm', 72, 2160],
                ['Idler Roller Set', 2, 'set', 400, 800]
            ],
            timeline: [
                { when: 'Day 0 · 11:45', type: 'send', label: 'Quote generated and emailed to customer', done: true },
                { when: 'Day 2 · 11:45', type: 'loop', label: 'Automated follow-up #1 sent', done: true,
                  email: 'Hi Trinidad Cement, just checking if you had a chance to review the conveyor belt quote.' },
                { when: 'Day 5 · 11:45', type: 'loop', label: 'Automated follow-up #2 sent', done: true,
                  email: 'Following up once more — happy to adjust quantities or specs if needed.' },
                { when: 'Day 7 · 09:00', type: 'check', label: 'No reply within window. Marked Lost and archived.', done: true }
            ]
        }
    ];

    /* ---- Icons used in the timeline (from assets/icons/) ---- */
    const TL_ICON = {
        send: '<img src="/assets/icons/message-sent.png" alt="" class="tl-ic">',
        loop: '<img src="/assets/icons/email-follow-up.png" alt="" class="tl-ic">',
        check: '<span class="about-check-icon tl-check"></span>'
    };

    /* ---- Helpers ---- */
    const fmt = n => 'TTD ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtVal = n => 'TTD ' + n.toLocaleString('en-US');
    let selectedId = QUOTES[0].id;
    let typingTimer = null;

    const $ = id => document.getElementById(id);

    /* ---- Render the left pipeline ---- */
    function renderList() {
        const list = $('quoteList');
        list.innerHTML = '';
        QUOTES.forEach(q => {
            const el = document.createElement('div');
            el.className = \`quote-card s-\${q.status}\` + (q.id === selectedId ? ' selected' : '');
            el.innerHTML = \`
                <div class="qc-name">\${q.customer}</div>
                <div class="qc-meta">\${q.id} · \${q.sent}</div>
                <div class="qc-bottom">
                    <span class="qc-value">\${fmtVal(q.value)}</span>
                    <span class="badge b-\${q.status}">\${STATUS_TEXT[q.status]}</span>
                </div>\`;
            el.addEventListener('click', () => { selectedId = q.id; renderAll(); });
            list.appendChild(el);
        });
        $('activeCount').textContent = QUOTES.filter(q => q.status !== 'won' && q.status !== 'lost').length;
    }

    /* ---- Render the center detail + timeline ---- */
    function renderDetail() {
        const q = QUOTES.find(x => x.id === selectedId);
        $('dCustomer').textContent = q.customer;
        $('dSub').textContent = \`\${q.id} · \${q.sent}\`;
        const badge = $('dBadge');
        badge.className = \`badge b-\${q.status}\`;
        badge.textContent = STATUS_TEXT[q.status];

        $('dItems').innerHTML = q.items.map(it => \`
            <tr>
                <td>\${it[0]}</td>
                <td class="num">\${it[1]}</td>
                <td>\${it[2]}</td>
                <td class="num">\${it[3].toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                <td class="num">\${it[4].toLocaleString('en-US', {minimumFractionDigits:2})}</td>
            </tr>\`).join('');
        $('dTotal').textContent = fmt(q.value);

        $('timeline').innerHTML = q.timeline.map(s => \`
            <li class="tl-item \${s.done ? 'done' : ''}">
                <span class="tl-dot"></span>
                <div class="tl-when">\${s.when}</div>
                <div class="tl-label">\${TL_ICON[s.type] || ''} \${s.label}</div>
                \${s.done && s.email ? \`<div class="tl-note">"\${s.email}"</div>\` : ''}
            </li>\`).join('');

        // Simulate button state
        const next = q.timeline.find(s => !s.done);
        $('simBtn').style.display = next ? 'inline-flex' : 'none';
        $('simDoneNote').classList.toggle('show', !next);
        $('emailPreview').classList.remove('show');
    }

    function renderAll() { renderList(); renderDetail(); }

    /* ---- Simulate the next pending automation step ---- */
    function simulateNext() {
        const q = QUOTES.find(x => x.id === selectedId);
        const step = q.timeline.find(s => !s.done);
        if (!step) return;

        const btn = $('simBtn');
        btn.disabled = true;

        function finish() {
            step.done = true;
            // Advance the quote's status as the automation progresses
            const remaining = q.timeline.filter(s => !s.done).length;
            if (step.type === 'loop') {
                q.status = 'followup';
                // bump the live "followed up this month" counter
                const m = $('mFollowups'); m.textContent = (parseInt(m.textContent, 10) + 1);
            } else if (step.type === 'check') {
                q.status = step.label.toLowerCase().includes('lost') ? 'lost'
                         : step.label.toLowerCase().includes('won') || step.label.toLowerCase().includes('confirmed') ? 'won'
                         : 'replied';
            }
            renderAll();
            btn.disabled = false;
        }

        if (step.email) {
            // Show the email preview with a typing animation, then complete the step
            const box = $('emailPreview');
            const body = $('emailBody');
            $('emailFrom').textContent = 'From: quotes@accurateindustrial.tt   ·   To: ' + q.customer;
            box.classList.add('show');
            body.innerHTML = '<span class="typing-cursor"></span>';
            const text = step.email;
            let i = 0;
            clearInterval(typingTimer);
            typingTimer = setInterval(() => {
                i++;
                body.innerHTML = text.slice(0, i) + '<span class="typing-cursor"></span>';
                if (i >= text.length) {
                    clearInterval(typingTimer);
                    body.innerHTML = text;
                    setTimeout(finish, 450);
                }
            }, 18);
        } else {
            setTimeout(finish, 350);
        }
    }

    /* ---- Back link: return where the visitor came from ---- */
    $('backLink').addEventListener('click', e => {
        e.preventDefault();
        if (history.length > 1) history.back();
        else window.location.href = '/';
    });

    $('simBtn').addEventListener('click', simulateNext);

    renderAll();

    // --- BFCACHE RESTORE FIX ---
    window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
            document.body.classList.remove('page-exit');
            document.body.style.animation = 'pageIn 0.4s ease';
        }
    });
    ` }} />

    </>
  );
}
