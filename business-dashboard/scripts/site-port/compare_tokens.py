"""Compare the ported pages against the Netlify originals.

Two comparisons, because either alone can pass while the page is wrong:

  TEXT   the visible words, in order. Catches dropped or reordered content.
  CLASS  the multiset of CSS classes. Catches markup that survived the port
         with its styling hooks mangled.

Usage:  python compare_tokens.py <baseline-dir> <new-base-url>
"""
import collections
import io
import os
import re
import sys
import urllib.request

ROUTES = [
    ("index.html", "/"),
    ("services.html", "/services"),
    ("portfolio.html", "/portfolio"),
    ("demo.html", "/demo"),
    ("demo-aisl-quote-followup.html", "/demo/aisl-quote-followup"),
    ("demo-hyline-job-tracker.html", "/demo/hyline-job-tracker"),
    ("voice-receptionist.html", "/voice-receptionist"),
    ("about.html", "/about"),
    ("contact.html", "/contact"),
    ("links.html", "/links"),
]

# Both sides are compared after full entity decoding. Netlify serves the source
# byte-for-byte, so `&rarr;` stays an entity; React re-encodes text and emits
# `&#x27;` for an apostrophe. Both render identically, and comparing the decoded
# text is the only way to tell a real content change from an encoding one.
import html as _html


def unescape(s):
    return _html.unescape(s)


def strip_code(html):
    """Remove script, style and comments BEFORE anything else looks at the DOM.

    demo-hyline-job-tracker.html carries a literal `<body>` and `</body>` inside
    a JavaScript string (its end-of-shift report writes a whole HTML document),
    so slicing the body first lands the cut in the middle of a script and drags
    1,500 tokens of JavaScript into the comparison.
    """
    html = re.sub(r"<script.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style.*?</style>", " ", html, flags=re.S | re.I)
    return re.sub(r"<!--.*?-->", " ", html, flags=re.S)


def body_of(html):
    html = strip_code(html)
    m = re.search(r"<body[^>]*>", html, re.I)
    if m:
        html = html[m.end():]
    # rpartition, not sub: take the LAST closing tag, so a stray one cannot
    # truncate the page early.
    head, sep, _ = html.rpartition("</body>")
    return head if sep else html


def text_tokens(html):
    h = re.sub(r"<[^>]+>", " ", body_of(html))
    return [t for t in re.split(r"\s+", unescape(h)) if t]


def class_tokens(html):
    out = collections.Counter()
    # Both quote styles: Netlify Forms rewrites the contact <form> tag using
    # single quotes, which a double-quote-only pattern silently under-counts.
    for _q, m in re.findall(r"""\bclass=(["'])(.*?)\1""", body_of(html)):
        for c in m.split():
            out[c] += 1
    return out


# The site layout wraps every page in these. They are the mechanism that keeps
# the marketing CSS off the dashboard, so they are expected on all ten routes.
EXPECTED_EXTRA = re.compile(r"^(site-root|.*plus_jakarta_sans.*variable)$")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "port-check"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def main():
    baseline_dir, base_url = sys.argv[1], sys.argv[2].rstrip("/")
    failures = 0
    print("%-30s %-8s %-26s %s" % ("route", "status", "text tokens", "classes"))
    print("-" * 92)
    for fname, route in ROUTES:
        old = io.open(os.path.join(baseline_dir, fname), encoding="utf-8").read()
        try:
            new = fetch(base_url + route)
        except Exception as e:  # noqa: BLE001
            print("%-30s FETCH FAILED  %s" % (route, e))
            failures += 1
            continue

        ot, nt = text_tokens(old), text_tokens(new)
        oc, nc = class_tokens(old), class_tokens(new)

        text_ok = ot == nt
        missing_c = oc - nc
        extra_c = collections.Counter({
            k: v for k, v in (nc - oc).items() if not EXPECTED_EXTRA.match(k)})
        class_ok = not missing_c and not extra_c

        status = "OK" if (text_ok and class_ok) else "DIFF"
        if status == "DIFF":
            failures += 1
        print("%-30s %-8s %-26s %s" % (
            route, status,
            "%d vs %d %s" % (len(ot), len(nt), "same" if text_ok else "DIFFER"),
            "%d vs %d %s" % (sum(oc.values()), sum(nc.values()),
                             "same" if class_ok else "DIFFER")))

        if not text_ok:
            om = collections.Counter(ot) - collections.Counter(nt)
            nm = collections.Counter(nt) - collections.Counter(ot)
            if om:
                print("      only in original:", list(om.items())[:12])
            if nm:
                print("      only in ported  :", list(nm.items())[:12])
            if not om and not nm:
                for i, (a, b) in enumerate(zip(ot, nt)):
                    if a != b:
                        print("      same words, order differs at %d: %r vs %r"
                              % (i, ot[i:i + 6], nt[i:i + 6]))
                        break
        if missing_c:
            print("      classes lost   :", list(missing_c.items())[:12])
        if extra_c:
            print("      classes added  :", list(extra_c.items())[:12])

    print("-" * 92)
    print("%d/%d routes match" % (len(ROUTES) - failures, len(ROUTES)))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
