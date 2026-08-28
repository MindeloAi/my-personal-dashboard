import type { Metadata } from "next";
import Script from "next/script";
import "../../_styles/demo-hyline-job-tracker.css";

export const metadata: Metadata = {
    title: "Hyline · Job Tracker · Demo | Mindelo",
    description: "Interactive demo of the production job-tracking app Mindelo built for Hyline Label Company: floor visibility, job specs, operator notes, and end-of-shift reporting.",
    robots: {
      index: false,
      follow: true,
    },
    openGraph: {
      type: "website",
      siteName: "Mindelo",
      title: "Hyline · Job Tracker · Demo | Mindelo",
      description: "Interactive demo of the production job-tracking app Mindelo built for Hyline Label Company.",
      url: "https://mindelo.site/demo/hyline-job-tracker",
      locale: "en_TT",
      images: [{
        url: "https://mindelo.site/assets/img/og-image.jpg",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Hyline · Job Tracker · Demo | Mindelo",
      description: "Interactive demo of the production job-tracking app Mindelo built for Hyline Label Company.",
      images: ["https://mindelo.site/assets/img/og-image.jpg"],
    },
  };

export default function HylineJobTrackerDemoPage() {
  return (
    <>
      
      
    {/* ===== TOP BAR ===== */}
    <header className="demo-topbar">
        <a href="/" className="back-link" id="backLink">&larr; Back to Mindelo</a>
        <span className="demo-label">Hyline &middot; <b>Job Tracker</b> &middot; Demo</span>
        <span className="topbar-spacer"></span>
    </header>

    <div className="shell">
        {/* ===== STAT BAR ===== */}
        <div className="stat-bar">
            <div className="stat"><div className="s-lbl">Jobs in production</div><div className="s-val teal">12</div></div>
            <div className="stat"><div className="s-lbl">Jobs completed today</div><div className="s-val">4</div></div>
            <div className="stat"><div className="s-lbl">Re-prints this week</div><div className="s-val">2</div></div>
            <div className="stat"><div className="s-lbl">On-time delivery rate</div><div className="s-val teal">94%</div></div>
            <div className="stat"><div className="s-lbl">Avg. job cycle time</div><div className="s-val">3.2 <span style={{fontSize: "0.9rem", color: "#9ca3af"}}>days</span></div></div>
        </div>

        {/* ===== TOOLBAR ===== */}
        <div className="toolbar">
            <button className="chip active" data-filter="all">All</button>
            <button className="chip" data-filter="today">Today</button>
            <button className="chip" data-filter="urgent">Urgent</button>
            <button className="chip" data-filter="reprint">Re-prints</button>
            <select className="chip" id="custFilter">
                <option value="">By Customer ▾</option>
            </select>
            <button className="new-job-btn" id="newJobBtn">+ New Job</button>
        </div>

        {/* ===== KANBAN ===== */}
        <div className="board" id="board"></div>
    </div>

    {/* ===== DEMO FOOTER ===== */}
    <footer className="demo-foot">
        <p className="credit">Built for Hyline Label Company Ltd &middot; Tracking 12,000+ jobs through production since 2025. Numbers shown are illustrative for demo purposes.</p>
        <a href="/contact" className="consult-cta">Want this for your business? Book a free consult &rarr;</a>
    </footer>

    {/* ===== SIDE PANEL ===== */}
    <div className="side-overlay" id="sideOverlay"></div>
    <aside className="side-panel" id="sidePanel">
        <div className="sp-head">
            <div>
                <div className="sp-id" id="spId">—</div>
                <div className="sp-cust" id="spCust">—</div>
                <div className="sp-prod" id="spProd">—</div>
            </div>
            <button className="sp-close" id="spClose" aria-label="Close">&times;</button>
        </div>
        <div className="sp-body">
            <div className="sp-section">
                <h4>Job Specs</h4>
                <div className="spec-grid" id="spSpecs"></div>
            </div>
            <div className="sp-section">
                <h4>Production Status</h4>
                <div className="flow" id="spFlow"></div>
            </div>
            <div className="sp-section" id="spReworkSection" style={{display: "none"}}>
                <h4>Re-print / Rework Log</h4>
                <div className="rework-box">
                    <div className="rw-reason" id="spReworkReason"></div>
                    <div className="rw-cost" id="spReworkCost"></div>
                </div>
            </div>
            <div className="sp-section">
                <h4>Operator Notes</h4>
                <div id="spNotes"></div>
            </div>
            <div className="sp-section">
                <button className="report-btn" id="reportBtn">Generate end-of-shift report</button>
            </div>
        </div>
    </aside>

    {/* ===== NEW JOB MODAL ===== */}
    <div className="modal-ov" id="modalOv">
        <div className="modal">
            <h3>New Job Intake</h3>
            <form id="newJobForm">
                <div className="field"><label>Customer</label><input type="text" id="njCustomer" required placeholder="e.g. Carib Brewery" /></div>
                <div className="field"><label>Product</label><input type="text" id="njProduct" required placeholder="e.g. Wraparound label" /></div>
                <div className="field"><label>Quantity</label><input type="number" id="njQty" required placeholder="e.g. 5000" min="1" /></div>
                <div className="field"><label>Due date</label><input type="date" id="njDue" required /></div>
                <div className="field"><label>Special instructions</label><textarea id="njNotes" placeholder="Optional"></textarea></div>
                <div className="modal-actions">
                    <button type="submit" className="btn-primary">Add to Intake</button>
                    <button type="button" className="btn-ghost" id="njCancel">Cancel</button>
                </div>
            </form>
        </div>
    </div>

    {/* ===== FLOATING DEMO PILL ===== */}
    <div className="demo-pill"><span className="pulse-dot"></span> Demo &middot; Live data is illustrative</div>

    <Script id="demo-hyline-job-tracker-0" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: `
    /* =========================================================================
       HARDCODED DUMMY DATA — nothing here is real or persisted.
       Customers are illustrative T&T food & beverage manufacturers.
       Refreshing the page resets the board to this initial state.
       ========================================================================= */

    // Board columns, in order, with their accent color key.
    const COLUMNS = [
        { key: 'intake',     name: 'Intake',            cls: 'c-intake' },
        { key: 'production', name: 'In Production',     cls: 'c-production' },
        { key: 'qc',         name: 'Quality Check',     cls: 'c-qc' },
        { key: 'ready',      name: 'Ready for Delivery',cls: 'c-ready' },
        { key: 'delivered',  name: 'Delivered',         cls: 'c-delivered' }
    ];

    // Production flow shown in the side panel. progress = index of current stage.
    const FLOW = ['Intake', 'Press', 'Laminate', 'Cut', 'QC', 'Delivery'];

    let JOBS = [
        {
            id: 'HL-2026-0142', customer: 'Carib Brewery', product: '4-color shrink sleeve label', qty: 25000,
            stage: 'production', progress: 1, today: true, attrs: ['4-color', 'urgent'], reprint: false,
            specs: { Size: '210 × 95 mm', Colors: '4 + white', Material: 'PVC shrink film', Finish: 'Gloss' },
            notes: [
                { time: '07:42', who: 'JR', text: 'Color match approved by JR.' },
                { time: '08:15', who: 'MP', text: 'Adjusted tension on press 2.' }
            ], rework: null
        },
        {
            id: 'HL-2026-0139', customer: 'Angostura Ltd', product: 'Wraparound label · bitters', qty: 18000,
            stage: 'production', progress: 2, today: true, attrs: ['4-color'], reprint: false,
            specs: { Size: '180 × 70 mm', Colors: '4', Material: 'BOPP', Finish: 'Matte + spot UV' },
            notes: [ { time: '06:55', who: 'KA', text: 'Plates mounted, registration checked.' } ], rework: null
        },
        {
            id: 'HL-2026-0144', customer: 'S.M. Jaleel', product: 'Bottle neck label · 5,000 units', qty: 5000,
            stage: 'intake', progress: 0, today: true, attrs: ['urgent'], reprint: false,
            specs: { Size: '90 × 60 mm', Colors: '3', Material: 'Paper', Finish: 'Gloss varnish' },
            notes: [ { time: '09:10', who: 'Office', text: 'Artwork received, awaiting proof sign-off.' } ], rework: null
        },
        {
            id: 'HL-2026-0145', customer: 'Bermudez Biscuit Co.', product: 'Carton wrap · crackers', qty: 12000,
            stage: 'intake', progress: 0, today: false, attrs: ['4-color'], reprint: false,
            specs: { Size: '320 × 210 mm', Colors: '4', Material: 'Coated board', Finish: 'Gloss' },
            notes: [ { time: '08:30', who: 'Office', text: 'Job booked. Scheduled for next press slot.' } ], rework: null
        },
        {
            id: 'HL-2026-0136', customer: 'Nestlé Trinidad', product: 'Sleeve label · dairy', qty: 30000,
            stage: 'qc', progress: 4, today: true, attrs: ['4-color'], reprint: true,
            specs: { Size: '200 × 110 mm', Colors: '5', Material: 'PETG shrink', Finish: 'Gloss' },
            notes: [
                { time: '10:02', who: 'QC', text: 'First batch flagged — slight color drift on cyan.' },
                { time: '10:40', who: 'MP', text: 'Re-printed affected rolls. Re-checking.' }
            ],
            rework: { reason: 'Color drift on cyan channel, batch 2.', cost: 1840 }
        },
        {
            id: 'HL-2026-0131', customer: 'KC Confectionery', product: 'Flow-wrap film · sweets', qty: 40000,
            stage: 'qc', progress: 4, today: false, attrs: ['4-color'], reprint: false,
            specs: { Size: 'Reel 320 mm', Colors: '6', Material: 'Metallised film', Finish: 'Matte' },
            notes: [ { time: '09:25', who: 'QC', text: 'Seal strength within spec. Awaiting final sign-off.' } ], rework: null
        },
        {
            id: 'HL-2026-0128', customer: 'Blue Waters', product: 'Wraparound label · 1,000 units', qty: 1000,
            stage: 'ready', progress: 5, today: false, attrs: [], reprint: false,
            specs: { Size: '150 × 90 mm', Colors: '2', Material: 'BOPP', Finish: 'Gloss' },
            notes: [ { time: '11:15', who: 'Pack', text: 'Packed and palletised. Awaiting collection.' } ], rework: null
        },
        {
            id: 'HL-2026-0124', customer: 'Associated Brands', product: 'Carton label · biscuits', qty: 16000,
            stage: 'ready', progress: 5, today: true, attrs: ['4-color'], reprint: false,
            specs: { Size: '260 × 180 mm', Colors: '4', Material: 'Coated board', Finish: 'Matte lam' },
            notes: [ { time: '12:05', who: 'Pack', text: 'Boxed for delivery run 2.' } ], rework: null
        },
        {
            id: 'HL-2026-0122', customer: 'Solo Beverages', product: 'Shrink sleeve · soft drink', qty: 28000,
            stage: 'ready', progress: 5, today: false, attrs: ['urgent', '4-color'], reprint: false,
            specs: { Size: '195 × 100 mm', Colors: '5', Material: 'PVC shrink', Finish: 'Gloss' },
            notes: [ { time: '10:50', who: 'Pack', text: 'Ready for collection — courier booked.' } ], rework: null
        },
        {
            id: 'HL-2026-0115', customer: 'Carib Brewery', product: 'Crown cork liner print', qty: 50000,
            stage: 'delivered', progress: 6, today: false, attrs: ['4-color'], reprint: false,
            specs: { Size: '32 mm', Colors: '3', Material: 'Liner board', Finish: 'Gloss' },
            notes: [ { time: 'Yesterday 16:20', who: 'Dispatch', text: 'Delivered and signed for.' } ], rework: null
        },
        {
            id: 'HL-2026-0109', customer: 'S.M. Jaleel', product: 'Multipack wrap', qty: 22000,
            stage: 'delivered', progress: 6, today: false, attrs: [], reprint: true,
            specs: { Size: '380 × 240 mm', Colors: '4', Material: 'BOPP', Finish: 'Gloss' },
            notes: [ { time: 'Yesterday 15:00', who: 'Dispatch', text: 'Delivered. Re-print credited on prior batch.' } ],
            rework: { reason: 'Print smudge on first run, customer batch 1.', cost: 920 }
        }
    ];

    let nextSeq = 146; // for new job IDs
    let currentFilter = 'all';
    let currentCustomer = '';
    let openJobId = null;

    const $ = id => document.getElementById(id);
    const fmtQty = n => n.toLocaleString('en-US');

    /* ---- Build the customer filter dropdown ---- */
    function refreshCustomerOptions() {
        const sel = $('custFilter');
        const customers = [...new Set(JOBS.map(j => j.customer))].sort();
        const cur = sel.value;
        sel.innerHTML = '<option value="">By Customer ▾</option>' +
            customers.map(c => \`<option value="\${c}">\${c}</option>\`).join('');
        sel.value = cur && customers.includes(cur) ? cur : '';
    }

    /* ---- Does a job pass the active filters? ---- */
    function jobVisible(j) {
        if (currentCustomer && j.customer !== currentCustomer) return false;
        if (currentFilter === 'today') return j.today;
        if (currentFilter === 'urgent') return j.attrs.includes('urgent');
        if (currentFilter === 'reprint') return j.reprint;
        return true;
    }

    /* ---- Render the kanban board ---- */
    function renderBoard(animateId) {
        const board = $('board');
        board.innerHTML = '';
        COLUMNS.forEach(col => {
            const jobs = JOBS.filter(j => j.stage === col.key && jobVisible(j));
            const colEl = document.createElement('div');
            colEl.className = \`col \${col.cls}\`;
            colEl.innerHTML = \`
                <div class="col-head">
                    <span class="c-name"><span class="col-dot"></span>\${col.name}</span>
                    <span class="col-count">\${jobs.length}</span>
                </div>
                <div class="col-cards"></div>\`;
            const cards = colEl.querySelector('.col-cards');
            jobs.forEach(j => {
                const tags = [];
                if (j.attrs.includes('4-color')) tags.push('<span class="tag tag-color">4-color</span>');
                if (j.attrs.includes('urgent')) tags.push('<span class="tag tag-urgent">Urgent</span>');
                if (j.reprint) tags.push('<span class="tag tag-reprint">Re-print</span>');
                tags.push(\`<span class="tag tag-qty">\${fmtQty(j.qty)} u</span>\`);
                const card = document.createElement('div');
                card.className = 'job-card' + (col.key === 'delivered' ? ' dimmed' : '') + (j.id === animateId ? ' new-card' : '');
                card.innerHTML = \`
                    <div class="jc-id">\${j.id}</div>
                    <div class="jc-cust">\${j.customer}</div>
                    <div class="jc-prod">\${j.product}</div>
                    <div class="jc-tags">\${tags.join('')}</div>\`;
                card.addEventListener('click', () => openPanel(j.id));
                cards.appendChild(card);
            });
            board.appendChild(colEl);
        });
    }

    /* ---- Open the side panel for a job ---- */
    function openPanel(id) {
        const j = JOBS.find(x => x.id === id);
        if (!j) return;
        openJobId = id;
        $('spId').textContent = j.id;
        $('spCust').textContent = j.customer;
        $('spProd').textContent = j.product + ' · ' + fmtQty(j.qty) + ' units';

        $('spSpecs').innerHTML = Object.entries(j.specs)
            .map(([k, v]) => \`<div class="spec"><div class="k">\${k}</div><div class="v">\${v}</div></div>\`).join('');

        $('spFlow').innerHTML = FLOW.map((step, i) => {
            const cls = i < j.progress ? 'done' : (i === j.progress ? 'current' : '');
            return \`<div class="flow-step \${cls}"><div class="flow-dot"></div><div class="flow-lbl">\${step}</div></div>\`;
        }).join('');

        if (j.rework) {
            $('spReworkSection').style.display = 'block';
            $('spReworkReason').textContent = j.rework.reason;
            $('spReworkCost').textContent = 'Cost impact: TTD ' + fmtQty(j.rework.cost);
        } else {
            $('spReworkSection').style.display = 'none';
        }

        $('spNotes').innerHTML = j.notes.map(n =>
            \`<div class="note"><div class="n-meta"><b>\${n.who}</b> · \${n.time}</div><div class="n-text">\${n.text}</div></div>\`).join('');

        $('sidePanel').classList.add('open');
        $('sideOverlay').classList.add('open');
    }
    function closePanel() {
        $('sidePanel').classList.remove('open');
        $('sideOverlay').classList.remove('open');
        openJobId = null;
    }

    /* ---- Filters ---- */
    document.querySelectorAll('.chip[data-filter]').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip[data-filter]').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderBoard();
        });
    });
    $('custFilter').addEventListener('change', e => {
        currentCustomer = e.target.value;
        renderBoard();
    });

    /* ---- New Job modal ---- */
    $('newJobBtn').addEventListener('click', () => $('modalOv').classList.add('open'));
    $('njCancel').addEventListener('click', () => $('modalOv').classList.remove('open'));
    $('modalOv').addEventListener('click', e => { if (e.target === $('modalOv')) $('modalOv').classList.remove('open'); });
    $('newJobForm').addEventListener('submit', e => {
        e.preventDefault();
        const id = 'HL-2026-0' + (nextSeq++);
        const qty = parseInt($('njQty').value, 10) || 0;
        const note = $('njNotes').value.trim();
        JOBS.unshift({
            id, customer: $('njCustomer').value.trim(), product: $('njProduct').value.trim(), qty,
            stage: 'intake', progress: 0, today: true, attrs: [], reprint: false,
            specs: { Quantity: fmtQty(qty) + ' units', 'Due date': $('njDue').value || '—', Status: 'New intake', Source: 'Manual entry' },
            notes: note ? [{ time: 'Just now', who: 'Office', text: note }]
                        : [{ time: 'Just now', who: 'Office', text: 'Job created via intake form.' }],
            rework: null
        });
        $('newJobForm').reset();
        $('modalOv').classList.remove('open');
        // reset filters so the new card is visible, then animate it in
        currentFilter = 'all'; currentCustomer = '';
        document.querySelectorAll('.chip[data-filter]').forEach(c => c.classList.toggle('active', c.dataset.filter === 'all'));
        refreshCustomerOptions();
        renderBoard(id);
    });

    /* ---- End-of-shift report (opens a styled preview in a new tab) ---- */
    $('reportBtn').addEventListener('click', () => {
        const btn = $('reportBtn');
        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Assembling report…';
        setTimeout(() => {
            openReport();
            btn.disabled = false;
            btn.textContent = original;
        }, 900);
    });

    function openReport() {
        const counts = COLUMNS.map(c => ({ name: c.name, n: JOBS.filter(j => j.stage === c.key).length }));
        const reprints = JOBS.filter(j => j.reprint);
        const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const rows = JOBS.map(j => \`
            <tr>
                <td>\${j.id}</td><td>\${j.customer}</td><td>\${j.product}</td>
                <td style="text-align:right">\${fmtQty(j.qty)}</td>
                <td>\${COLUMNS.find(c => c.key === j.stage).name}</td>
            </tr>\`).join('');
        const html = \`<!DOCTYPE html><html><head><meta charset="utf-8">
            <title>Hyline · End-of-Shift Report</title>
            <style>
                body{font-family:'Plus Jakarta Sans',Arial,sans-serif;background:#06090d;color:#f3f4f6;margin:0;padding:40px;}
                .wrap{max-width:840px;margin:0 auto;}
                h1{font-size:1.7rem;letter-spacing:-0.03em;margin:0;}
                .sub{color:#9ca3af;font-size:0.85rem;margin-top:4px;}
                .pill{display:inline-block;margin-top:14px;font-size:0.7rem;color:#04130f;background:#00e5b0;font-weight:800;padding:4px 10px;border-radius:999px;}
                .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:26px 0;}
                .c{background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;}
                .c .l{font-size:0.65rem;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;}
                .c .v{font-size:1.5rem;font-weight:800;color:#00e5b0;margin-top:4px;}
                table{width:100%;border-collapse:collapse;margin-top:10px;font-size:0.82rem;}
                th{text-align:left;color:#6b7280;text-transform:uppercase;font-size:0.62rem;letter-spacing:0.06em;border-bottom:1px solid rgba(255,255,255,0.12);padding:8px;}
                td{padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);color:#d1d5db;}
                h2{font-size:0.8rem;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-top:30px;}
                .foot{margin-top:30px;font-size:0.72rem;color:#6b7280;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;}
            </style></head><body><div class="wrap">
            <h1>End-of-Shift Report</h1>
            <div class="sub">Hyline Label Company Ltd · Production Floor · \${today}</div>
            <span class="pill">Demo · Illustrative data</span>
            <div class="cards">
                \${counts.map(c => \`<div class="c"><div class="l">\${c.name}</div><div class="v">\${c.n}</div></div>\`).join('')}
            </div>
            <h2>Jobs on the board</h2>
            <table><thead><tr><th>Job ID</th><th>Customer</th><th>Product</th><th style="text-align:right">Qty</th><th>Stage</th></tr></thead>
            <tbody>\${rows}</tbody></table>
            <h2>Re-prints / Rework this shift (\${reprints.length})</h2>
            \${reprints.length
                ? '<table><tbody>' + reprints.map(j => \`<tr><td>\${j.id}</td><td>\${j.customer}</td><td>\${j.rework ? j.rework.reason : '—'}</td><td style="text-align:right">\${j.rework ? 'TTD ' + fmtQty(j.rework.cost) : ''}</td></tr>\`).join('') + '</tbody></table>'
                : '<p style="color:#9ca3af;font-size:0.85rem;">No re-prints flagged.</p>'}
            <div class="foot">Generated by the Hyline Job Tracker · Built by Mindelo. This is illustrative demo output and not a real production record.</div>
            </div></body></html>\`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    }

    /* ---- Wiring ---- */
    $('spClose').addEventListener('click', closePanel);
    $('sideOverlay').addEventListener('click', closePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePanel(); $('modalOv').classList.remove('open'); } });
    $('backLink').addEventListener('click', e => {
        e.preventDefault();
        if (history.length > 1) history.back(); else window.location.href = '/';
    });

    refreshCustomerOptions();
    renderBoard();

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
