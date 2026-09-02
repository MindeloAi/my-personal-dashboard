"""End-to-end browser test of the Supabase Auth flow on the Mindelo dashboard.

Verifies what curl cannot: that the login form actually posts, the session cookie
is written, the redirect lands, and the protected page renders real data rather
than an empty shell.
"""
from playwright.sync_api import sync_playwright

import os

# Defaults to the local server. Override to run the same checks against a
# deployment: AUTH_TEST_BASE=https://mindelo.site python scripts/auth-flow-test.py
BASE = os.environ.get("AUTH_TEST_BASE", "http://localhost:5622").rstrip("/")
EMAIL = "michaeltaylorwalker@mindelo.site"
PASSWORD = "michaelzane1234"

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context()
    page = ctx.new_page()

    # 1. Logged out, a protected route must bounce to /login.
    page.goto(f"{BASE}/admin/overview", wait_until="networkidle")
    check("logged out: /admin/overview redirects to /login", "/login" in page.url, page.url)

    # 2. The form must actually be there.
    has_email = page.locator('input[name="email"]').count() == 1
    has_pw = page.locator('input[name="password"]').count() == 1
    check("login form has email + password inputs", has_email and has_pw)

    # 3. Wrong password must be refused and must not grant a session.
    page.fill('input[name="email"]', EMAIL)
    page.fill('input[name="password"]', "definitely-not-the-password")
    page.click('button[type="submit"]')
    # networkidle is unreliable after a server-action submit: Next fires RSC
    # prefetches that the navigation aborts. Wait on the URL settling instead.
    page.wait_for_timeout(3500)
    check("wrong password is refused", "/login" in page.url, page.url)
    check(
        "wrong password shows an error message",
        "not recognised" in page.content(),
    )

    # 4. Correct password signs in and lands on /overview.
    page.fill('input[name="email"]', EMAIL)
    page.fill('input[name="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_url("**/admin/overview", timeout=15000)
    check("correct password lands on /admin/overview", page.url.rstrip("/").endswith("/admin/overview"), page.url)

    # 5. A Supabase session cookie must have been written.
    cookies = ctx.cookies()
    auth_cookies = [c["name"] for c in cookies if "auth-token" in c["name"] or c["name"].startswith("sb-")]
    check("session cookie written", len(auth_cookies) > 0, ", ".join(auth_cookies) or "none")

    # 6. The page must show REAL data, not an empty authenticated shell.
    body = page.content()
    check("renders the dashboard header", "Mindelo Dashboard" in body)
    has_money = "$" in body and any(ch.isdigit() for ch in body)
    check("renders real figures", has_money)

    # 7. Navigating to another protected route stays authenticated.
    page.goto(f"{BASE}/admin/finance", wait_until="networkidle")
    check("session persists across navigation", page.url.rstrip("/").endswith("/admin/finance"), page.url)
    fin = page.content()
    check("finance page renders invoice data", "Invoice" in fin or "Expenses" in fin)

    # 7b. The sign-out button must exist and actually end the session.
    page.goto(f"{BASE}/admin/overview", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    check("sign out button present", page.locator('button:has-text("Sign out")').count() >= 1)
    check("signed-in email shown", EMAIL in page.content())
    page.click('button:has-text("Sign out")')
    page.wait_for_timeout(3500)
    check("sign out lands on /login", "/login" in page.url, page.url)
    page.goto(f"{BASE}/admin/overview", wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    check("after sign out the gate is closed", "/login" in page.url, page.url)

    # 8. Clearing cookies must re-close the gate (proves the guard is real,
    #    not a one-time redirect).
    ctx.clear_cookies()
    page.goto(f"{BASE}/admin/overview", wait_until="networkidle")
    check("gate re-closes when the session is cleared", "/login" in page.url, page.url)

    page.screenshot(path="/tmp/auth_final.png")

    # ── Mobile: a modal must be reachable and submittable at phone size ────────
    # Regression test for the pre-2026-09 shell, which centred an overflowing
    # modal with no scroll, leaving the submit button permanently offscreen.
    # READ-ONLY: this opens the modal and measures it. It must never submit —
    # the local dev server writes to the live production database.
    mobile = browser.new_context(viewport={"width": 375, "height": 667})
    mpage = mobile.new_page()
    mpage.goto(f"{BASE}/login", wait_until="networkidle")
    mpage.fill('input[name="email"]', EMAIL)
    mpage.fill('input[name="password"]', PASSWORD)
    mpage.click('button[type="submit"]')
    mpage.wait_for_url("**/admin/overview", timeout=15000)

    mpage.goto(f"{BASE}/admin/leads", wait_until="networkidle")
    mpage.click('button:has-text("New lead")')
    mpage.wait_for_selector('[role="dialog"]', timeout=5000)

    submit = mpage.locator('[role="dialog"] button[type="submit"]')
    check("mobile: new-lead modal opens", submit.count() == 1)

    submit.scroll_into_view_if_needed()
    box = submit.bounding_box()
    check(
        "mobile: submit button is reachable inside the viewport",
        box is not None and 0 <= box["y"] <= 667 - box["height"],
        f"y={box['y'] if box else 'none'}",
    )

    # The page behind the modal must not scroll while it is open.
    body_overflow = mpage.evaluate("getComputedStyle(document.body).overflow")
    check("mobile: body scroll locked while modal open", body_overflow == "hidden")

    mpage.keyboard.press("Escape")
    mpage.wait_for_timeout(300)
    check("mobile: Escape closes the modal", mpage.locator('[role="dialog"]').count() == 0)

    mobile.close()

    browser.close()

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n{passed}/{len(results)} checks passed")
if passed != len(results):
    print("FAILURES:")
    for name, ok, detail in results:
        if not ok:
            print(f"  - {name}  {detail}")
raise SystemExit(0 if passed == len(results) else 1)
