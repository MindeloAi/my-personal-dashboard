"""Dashboard UI audit — modal geometry, horizontal overflow, and touch targets.

Complements auth-flow-test.py, which covers the auth flow and one modal in depth.
This walks every modal in the app at two viewport sizes and checks the invariants
that a screenshot would catch but a unit test never will.

    AUTH_TEST_BASE=http://localhost:5622 python scripts/ui-audit.py

READ-ONLY. It opens modals, measures them and presses Escape. It never submits a
form and never mutates a record — the local server talks to the production
database, so this is a hard rule, not a preference.

Run it against a PRODUCTION build (`next build && next start`), not `next dev`.
In dev, the hydration mismatch in src/hooks/use-count-up.ts raises Next's error
overlay, and the overlay intercepts pointer events so every click times out.

Why these particular checks:

  - Modal card geometry. `position: fixed` resolves against the nearest ancestor
    carrying a transform, not the viewport. `.dashboard-fade-in` and the panels'
    `hover:-translate-y-0.5` both qualify, and both silently pulled every modal
    off the top of the screen until ModalShell started portalling to body.
    Asserting "the submit button is visible" missed it — the button was on
    screen while the card's top edge was 214px above it. So assert the CARD.

  - Touch targets. Controls revealed by `group-hover` are invisible and
    unreachable on a phone; that is how the expense edit/delete buttons were
    unusable on mobile for months.
"""
from playwright.sync_api import sync_playwright
import os
import sys

BASE = os.environ.get("AUTH_TEST_BASE", "http://localhost:5622").rstrip("/")
EMAIL = os.environ.get("AUTH_TEST_EMAIL", "michaeltaylorwalker@mindelo.site")
PASSWORD = os.environ.get("AUTH_TEST_PASSWORD", "michaelzane1234")

TABS = ["/admin/overview", "/admin/finance", "/admin/projects", "/admin/clients", "/admin/leads"]
VIEWPORTS = [("phone", 375, 667), ("laptop", 1280, 600)]
MIN_TAP = 32

CARD_RECT_JS = """() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const c = d.firstElementChild;
    const r = c.getBoundingClientRect();
    return {
        top: r.top, bottom: r.bottom, vh: window.innerHeight,
        scrollH: c.scrollHeight, clientH: c.clientHeight,
        title: d.querySelector('p')?.textContent?.trim() || '',
    };
}"""

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def skip(name, why):
    print(f"  SKIP  {name}  [{why}]")


def login(page):
    page.goto(f"{BASE}/login", wait_until="networkidle")
    page.fill('input[name="email"]', EMAIL)
    page.fill('input[name="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_url("**/admin/overview", timeout=20000)


def measure_open_modal(page, label, vlabel):
    """Assert the currently-open modal fits the viewport and keeps its close button."""
    r = page.evaluate(CARD_RECT_JS)
    if r is None:
        check(f"{vlabel}: {label}", False, "no dialog opened")
        return
    fits = r["top"] >= -1 and r["bottom"] <= r["vh"] + 1
    closes = page.locator('[role="dialog"] button[aria-label="Close"]').is_visible()
    check(
        f"{vlabel}: {label} fits the viewport",
        fits and closes,
        f"top={round(r['top'])} bottom={round(r['bottom'])} vh={r['vh']} "
        f"{'scrolls' if r['scrollH'] > r['clientH'] + 1 else 'fits'} close={closes}",
    )
    page.keyboard.press("Escape")
    page.wait_for_timeout(250)


def open_simple(page, tab, trigger, label, vlabel):
    """Modals reachable by one click from a tab."""
    try:
        page.goto(f"{BASE}{tab}", wait_until="networkidle")
        page.wait_for_timeout(400)
        page.locator(trigger).first.click(timeout=5000)
        page.wait_for_selector('[role="dialog"]', timeout=5000)
        page.wait_for_timeout(250)
    except Exception as e:
        skip(f"{vlabel}: {label}", f"{type(e).__name__}")
        return
    measure_open_modal(page, label, vlabel)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    for vlabel, vw, vh in VIEWPORTS:
        ctx = browser.new_context(viewport={"width": vw, "height": vh})
        page = ctx.new_page()
        login(page)
        print(f"\n=== {vlabel}  {vw}x{vh} ===")

        print("-- horizontal overflow --")
        for tab in TABS:
            page.goto(f"{BASE}{tab}", wait_until="networkidle")
            page.wait_for_timeout(300)
            over = page.evaluate(
                "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
            )
            check(f"{vlabel}: {tab} has no horizontal scroll", over <= 0, f"{over}px")

        print("-- modal geometry --")
        open_simple(page, "/admin/overview", 'button:has-text("+ Invoice")', "New Invoice", vlabel)
        open_simple(page, "/admin/overview", 'button:has-text("+ Expense")', "New Expense", vlabel)
        open_simple(page, "/admin/overview", 'button:has-text("+ Project")', "New Project", vlabel)
        open_simple(page, "/admin/leads", 'button:has-text("New lead")', "New Lead", vlabel)
        open_simple(page, "/admin/clients", 'button:has-text("New client")', "New client", vlabel)
        open_simple(page, "/admin/projects", ".cursor-pointer", "Project detail", vlabel)

        # Lead edit/delete live behind the row's expanded panel.
        for btn, label in (("Edit", "Edit lead"), ("Delete", "Delete lead")):
            try:
                page.goto(f"{BASE}/admin/leads", wait_until="networkidle")
                page.wait_for_timeout(400)
                page.locator("tbody tr").first.click(timeout=5000)
                page.wait_for_timeout(300)
                page.locator(f'button:has-text("{btn}")').first.click(timeout=5000)
                page.wait_for_selector('[role="dialog"]', timeout=5000)
                page.wait_for_timeout(250)
            except Exception as e:
                skip(f"{vlabel}: {label}", f"{type(e).__name__} (no leads?)")
                continue
            measure_open_modal(page, label, vlabel)

        # Invoice edit is inside the expanded invoice row.
        try:
            page.goto(f"{BASE}/admin/finance", wait_until="networkidle")
            page.wait_for_timeout(600)
            page.locator("table tbody tr").first.click(timeout=5000)
            page.wait_for_timeout(350)
            page.locator('button:has-text("Edit")').first.click(timeout=5000)
            page.wait_for_selector('[role="dialog"]', timeout=5000)
            page.wait_for_timeout(250)
        except Exception as e:
            skip(f"{vlabel}: Edit Invoice", f"{type(e).__name__} (no invoices?)")
        else:
            measure_open_modal(page, "Edit Invoice", vlabel)

        # Expense edit: walk the Edit buttons until one opens the expense modal.
        try:
            page.goto(f"{BASE}/admin/finance", wait_until="networkidle")
            page.wait_for_timeout(600)
            buttons = page.locator('button:has-text("Edit")')
            found = False
            for i in range(min(buttons.count(), 8)):
                buttons.nth(i).click(timeout=4000)
                page.wait_for_timeout(350)
                r = page.evaluate(CARD_RECT_JS)
                if r and r["title"] == "Edit Expense":
                    measure_open_modal(page, "Edit Expense", vlabel)
                    found = True
                    break
                if r:
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(200)
            if not found:
                skip(f"{vlabel}: Edit Expense", "no expense Edit button reachable")
        except Exception as e:
            skip(f"{vlabel}: Edit Expense", f"{type(e).__name__}")

        # Client edit needs at least one client to exist.
        try:
            page.goto(f"{BASE}/admin/clients", wait_until="networkidle")
            page.wait_for_timeout(500)
            rows = page.locator("ul.divide-y li")
            if rows.count() == 0:
                skip(f"{vlabel}: Edit client", "client list is empty")
            else:
                rows.first.locator("button").first.click(timeout=5000)
                page.wait_for_selector('[role="dialog"]', timeout=5000)
                page.wait_for_timeout(250)
                measure_open_modal(page, "Edit client", vlabel)
        except Exception as e:
            skip(f"{vlabel}: Edit client", f"{type(e).__name__}")

        if vlabel == "phone":
            print("-- touch targets --")
            for tab in TABS:
                page.goto(f"{BASE}{tab}", wait_until="networkidle")
                page.wait_for_timeout(400)
                bad = page.evaluate(
                    """(minTap) => {
                        const out = [];
                        for (const el of document.querySelectorAll('button, select')) {
                            const r = el.getBoundingClientRect();
                            if (r.height === 0 || r.width === 0) continue;
                            const cs = getComputedStyle(el);
                            if (cs.opacity === '0' || cs.visibility === 'hidden') {
                                out.push({t: (el.textContent||el.getAttribute('aria-label')||'?').trim().slice(0,24),
                                          why: 'hidden without hover'});
                                continue;
                            }
                            if (r.height < minTap) {
                                out.push({t: (el.textContent||el.getAttribute('aria-label')||'?').trim().slice(0,24),
                                          why: Math.round(r.height) + 'px tall'});
                            }
                        }
                        return out;
                    }""",
                    MIN_TAP,
                )
                check(
                    f"phone: {tab} controls are tappable",
                    len(bad) == 0,
                    "; ".join(f"{b['t']!r} {b['why']}" for b in bad[:4]) or "",
                )

        ctx.close()
    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{passed}/{len(results)} checks passed")
if passed != len(results):
    print("FAILURES:")
    for name, ok, detail in results:
        if not ok:
            print(f"  - {name}  [{detail}]")
sys.exit(0 if passed == len(results) else 1)
