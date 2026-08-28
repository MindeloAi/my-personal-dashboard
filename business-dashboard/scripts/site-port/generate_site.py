"""Generate src/app/(site)/** from the ten hand-written Mindelo-Website pages.

Run from the Mindelo-Website checkout. Writes into the dashboard repo.
"""
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from html2jsx import convert  # noqa: E402

SRC = r"C:\Users\taylo\Mindelo-Website"
APP_ROOT = r"C:\Users\taylo\my-personal-dashboard\business-dashboard"
DST = os.path.join(APP_ROOT, "src", "app", "(site)")

# source file -> route directory under (site). "" means the site index.
PAGES = [
    ("index.html", ""),
    ("services.html", "services"),
    ("portfolio.html", "portfolio"),
    ("demo.html", "demo"),
    ("demo-aisl-quote-followup.html", "demo/aisl-quote-followup"),
    ("demo-hyline-job-tracker.html", "demo/hyline-job-tracker"),
    ("voice-receptionist.html", "voice-receptionist"),
    ("about.html", "about"),
    ("contact.html", "contact"),
    ("linktree.html", "links"),
]

COMPONENT = {
    "": "HomePage", "services": "ServicesPage", "portfolio": "PortfolioPage",
    "demo": "DemoPage", "demo/aisl-quote-followup": "AislQuoteFollowupDemoPage",
    "demo/hyline-job-tracker": "HylineJobTrackerDemoPage",
    "voice-receptionist": "VoiceReceptionistPage", "about": "AboutPage",
    "contact": "ContactPage", "links": "LinksPage",
}


# ── CSS scoping ──────────────────────────────────────────────────────────────
#
# The site stylesheets style `body` and `:root` directly. Left alone they would
# repaint the dashboard, which shares the same <body>. Every selector is
# therefore confined to the marketing subtree.
#
# body-level rules become `body:has(.site-root)` rather than moving onto the
# wrapper div, because the page-transition script toggles classes on
# document.body itself (`body.page-exit`). Rewriting those onto the wrapper
# would leave the CSS and the JS pointing at different elements.

SCOPE = ".site-root"
BODY_SCOPE = "body:has(.site-root)"


def scope_selector(sel):
    sel = sel.strip()
    if not sel:
        return sel
    if sel in (":root", "html"):
        return BODY_SCOPE
    if re.match(r"^body\b", sel):
        return BODY_SCOPE + sel[len("body"):]
    if re.match(r"^html\b", sel):
        return BODY_SCOPE + sel[len("html"):]
    if sel == "*":
        # `* { box-sizing }` and friends: the wrapper needs it too.
        return SCOPE + ", " + SCOPE + " *"
    return SCOPE + " " + sel


def split_top_level(s, sep):
    """Split on `sep` at nesting depth 0 (parens, brackets, quotes aware)."""
    out, buf, depth, quote = [], [], 0, None
    for ch in s:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in "\"'":
            quote = ch
            buf.append(ch)
            continue
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        if ch == sep and depth == 0:
            out.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    out.append("".join(buf))
    return out


def scope_css(css, inside_keyframes=False):
    """Walk the stylesheet rule by rule, scoping selectors as it goes."""
    out = []
    i = 0
    n = len(css)
    while i < n:
        # copy comments through untouched
        if css.startswith("/*", i):
            j = css.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append(css[i:j])
            i = j
            continue
        brace = css.find("{", i)
        if brace < 0:
            out.append(css[i:])
            break
        prelude = css[i:brace]
        # find the matching close brace
        depth, j = 1, brace + 1
        while j < n and depth:
            if css[j] == "{":
                depth += 1
            elif css[j] == "}":
                depth -= 1
            j += 1
        body = css[brace + 1:j - 1]

        # A comment sitting between two rules lands in the next rule's prelude.
        # Emit it separately, or it gets prefixed with the scope and becomes
        # `.site-root /* ... */ @keyframes`, which is a parse error.
        comments = re.findall(r"/\*.*?\*/", prelude, re.S)
        if comments:
            out.append("".join(comments))
            prelude = re.sub(r"/\*.*?\*/", "", prelude, flags=re.S)
        stripped = prelude.strip()

        if not stripped:
            # A block with no selector left after removing comments cannot be
            # scoped meaningfully; pass it through so nothing is silently lost.
            out.append(prelude + "{" + body + "}")
            i = j
            continue

        if stripped.startswith("@"):
            at = stripped.split(None, 1)[0].lower()
            if at in ("@keyframes", "@-webkit-keyframes", "@font-face",
                      "@counter-style", "@property"):
                # percentage/from/to selectors and descriptor blocks: verbatim
                out.append(prelude + "{" + body + "}")
            else:
                # @media, @supports, @layer: recurse into the contents
                out.append(prelude + "{" + scope_css(body) + "}")
        elif inside_keyframes:
            out.append(prelude + "{" + body + "}")
        else:
            lead = prelude[:len(prelude) - len(prelude.lstrip())]
            sels = [scope_selector(s) for s in split_top_level(stripped, ",")]
            out.append(lead + ", ".join(sels) + " {" + body + "}")
        i = j
    return "".join(out)


# ── metadata extraction ──────────────────────────────────────────────────────

def attr_of(tag, name):
    """Read one attribute, honouring whichever quote character was used.

    The obvious regex here stops at the first quote of either kind, which
    silently truncated every description containing an apostrophe.
    """
    m = re.search(r"\b" + re.escape(name) + r"\s*=\s*([\"'])(.*?)\1",
                  tag, re.S | re.I)
    return m.group(2) if m else None


def meta_content(head, **attrs):
    """Find <meta ...> content for a name= or property= key."""
    key, val = list(attrs.items())[0]
    for tag in re.findall(r"<meta\s[^>]*>", head, re.I):
        if (attr_of(tag, key) or "").lower() == val.lower():
            return attr_of(tag, "content")
    return None



def unescape_attr(s):
    if s is None:
        return None
    return (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", '"').replace("&#39;", "'"))


def build_metadata(head, route):
    title = re.search(r"<title>(.*?)</title>", head, re.S)
    title = unescape_attr(title.group(1).strip()) if title else None
    desc = unescape_attr(meta_content(head, name="description"))
    keywords = unescape_attr(meta_content(head, name="keywords"))
    robots = meta_content(head, name="robots")
    canon = None
    for tag in re.findall(r"<link\s[^>]*>", head, re.I):
        if (attr_of(tag, "rel") or "").lower() == "canonical":
            canon = attr_of(tag, "href")

    og = {k: unescape_attr(meta_content(head, property="og:" + k))
          for k in ("type", "site_name", "title", "description", "url",
                    "image", "image:width", "image:height", "locale")}
    tw = {k: unescape_attr(meta_content(head, name="twitter:" + k))
          for k in ("card", "title", "description", "image")}

    m = {}
    if title:
        m["title"] = title
    if desc:
        m["description"] = desc
    if keywords:
        m["keywords"] = keywords
    if canon:
        # metadataBase lives in the site layout; canonical is stored as a path
        # so the same tree works on a preview URL and on mindelo.site.
        path = canon.replace("https://mindelo.site", "") or "/"
        m["alternates"] = {"canonical": path}
    if robots:
        low = robots.lower()
        m["robots"] = {"index": "noindex" not in low, "follow": "nofollow" not in low}

    o = {}
    if og["type"]:
        o["type"] = og["type"]
    if og["site_name"]:
        o["siteName"] = og["site_name"]
    if og["title"]:
        o["title"] = og["title"]
    if og["description"]:
        o["description"] = og["description"]
    if og["url"]:
        o["url"] = og["url"]
    if og["locale"]:
        o["locale"] = og["locale"]
    if og["image"]:
        img = {"url": og["image"]}
        if og["image:width"]:
            img["width"] = int(og["image:width"])
        if og["image:height"]:
            img["height"] = int(og["image:height"])
        o["images"] = [img]
    if o:
        m["openGraph"] = o

    t = {}
    if tw["card"]:
        t["card"] = tw["card"]
    if tw["title"]:
        t["title"] = tw["title"]
    if tw["description"]:
        t["description"] = tw["description"]
    if tw["image"]:
        t["images"] = [tw["image"]]
    if t:
        m["twitter"] = t
    return m


def ts_literal(v, indent=2):
    pad = " " * indent
    if isinstance(v, dict):
        if not v:
            return "{}"
        rows = []
        for k, val in v.items():
            key = k if re.match(r"^[A-Za-z_$][A-Za-z0-9_$]*$", k) else json.dumps(k)
            rows.append(pad + "  " + key + ": " + ts_literal(val, indent + 2) + ",")
        return "{\n" + "\n".join(rows) + "\n" + pad + "}"
    if isinstance(v, list):
        return "[" + ", ".join(ts_literal(x, indent) for x in v) + "]"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return json.dumps(v, ensure_ascii=False)


# ── main ─────────────────────────────────────────────────────────────────────

def js_template(s):
    """Embed raw JS in a TS template literal without it being re-parsed."""
    return s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def build_page(src_name, route):
    html = io.open(os.path.join(SRC, src_name), encoding="utf-8").read()

    body_m = re.search(r"<body[^>]*>", html)
    head = html[:body_m.start()]
    body_inner = html[body_m.end():]
    body_inner = re.sub(r"</body\s*>.*$", "", body_inner, flags=re.S)

    # Head scripts that must survive: the ld+json blocks and the analytics pair.
    head_jsx, head_scripts, head_styles = convert(head[head.index(">", head.index("<head")) + 1:]
                                                  if "<head" in head else head)
    body_jsx, body_scripts, body_styles = convert(body_inner)

    metadata = build_metadata(head, route)

    # `href="assets/..."` resolved fine while every page was a top-level file,
    # but /demo/hyline-job-tracker would resolve it to /demo/assets/... Anchor
    # every site asset reference at the root so nesting stops mattering.
    body_jsx = re.sub(r'((?:src|href|poster|data-image|data-photo)=")assets/',
                      lambda m: m.group(1) + "/assets/", body_jsx)


    # The contact form was Netlify Forms, which does not exist off Netlify. The
    # markup, the classes and the submit script are all left exactly as they
    # were: only the endpoint changes, so the success and error states a visitor
    # sees are the same ones that have been shipping.
    body_jsx = body_jsx.replace(
        '<form id="contact-form" name="contact" method="POST" action="/" '
        'data-netlify="true" data-netlify-honeypot="bot-field" '
        'className="space-y-4">',
        '<form id="contact-form" name="contact" method="POST" '
        'action="/api/contact" className="space-y-4">')
    body_jsx = body_jsx.replace(
        '<input type="hidden" name="form-name" value="contact" />', "")

    # ---- CSS ----
    css_blocks = head_styles + body_styles
    scoped = "\n".join(scope_css(c) for c in css_blocks)

    # ---- assemble the JSX ----
    def script_jsx(attrs, code, key):
        a = dict(attrs)
        parts = []
        if "type" in a:
            parts.append('type="%s"' % a["type"])
        if "src" in a:
            parts.append('src="%s"' % a["src"])
        if "async" in a:
            parts.append("async")
        if "defer" in a:
            parts.append("defer")
        attr_s = (" " + " ".join(parts)) if parts else ""
        if "src" in a:
            if "cdn.tailwindcss.com" in a["src"]:
                # Replaced by the app's own Tailwind v4 build. See globals.css.
                return ""
            return "<script%s />" % attr_s
        if not code.strip():
            return ""
        return ('<script%s dangerouslySetInnerHTML={{ __html: `%s` }} />'
                % (attr_s, js_template(code)))

    def splice(jsx, scripts):
        def sub(m):
            idx = int(m.group(1))
            return script_jsx(scripts[idx][0], scripts[idx][1], idx)
        return re.sub(r"@@SCRIPT(\d+)@@", sub, jsx)

    # style placeholders are dropped: the CSS is emitted to a real stylesheet
    head_jsx = re.sub(r"@@STYLE\d+@@", "", head_jsx)
    body_jsx = re.sub(r"@@STYLE\d+@@", "", body_jsx)
    head_jsx = splice(head_jsx, head_scripts)
    body_jsx = splice(body_jsx, body_scripts)

    # These two live inside <script> bodies, so they can only be rewritten once
    # the scripts have been spliced back into the markup.
    #
    # Sophie moved from a Netlify Function to a Next route handler, and the
    # contact form's AJAX submit now posts to a route handler instead of to
    # Netlify Forms. Same request shape, same success and error handling.
    body_jsx = body_jsx.replace("/.netlify/functions/chat", "/api/chat")
    body_jsx = body_jsx.replace("fetch('/', {", "fetch('/api/contact', {")

    # From the head, keep only the scripts (ld+json and analytics). The rest of
    # the head is metadata, which Next now emits from the exported object, and
    # the favicon/font links, which the site layout owns.
    kept_head = "".join(re.findall(r"<script[^>]*(?:/>|>.*?</script>)", head_jsx, re.S))

    if "data-stop-propagation" in body_jsx:
        body_jsx += (
            '<script dangerouslySetInnerHTML={{ __html: `'
            "document.querySelectorAll('[data-stop-propagation]').forEach("
            "function (el) { el.addEventListener('click', function (e) "
            "{ e.stopPropagation(); }); });"
            '` }} />')

    return metadata, scoped, kept_head, body_jsx


def main():
    os.makedirs(DST, exist_ok=True)
    styles_dir = os.path.join(DST, "_styles")
    os.makedirs(styles_dir, exist_ok=True)
    report = []

    for src_name, route in PAGES:
        metadata, css, head_scripts, body_jsx = build_page(src_name, route)
        slug = route.replace("/", "-") or "home"

        io.open(os.path.join(styles_dir, slug + ".css"), "w",
                encoding="utf-8", newline="\n").write(
            "/* Ported from %s. Scoped to the marketing site so it cannot\n"
            "   reach the dashboard, which shares the same <body>. */\n\n%s\n"
            % (src_name, css.strip()))

        out_dir = os.path.join(DST, *route.split("/")) if route else DST
        os.makedirs(out_dir, exist_ok=True)
        rel = "../" * (len(route.split("/")) if route else 0)
        css_import = rel + "_styles/" + slug + ".css" if route else "./_styles/" + slug + ".css"

        page = (
            'import type { Metadata } from "next";\n'
            'import "%s";\n\n'
            "export const metadata: Metadata = %s;\n\n"
            "export default function %s() {\n"
            "  return (\n"
            "    <>\n"
            "      %s\n"
            "      %s\n"
            "    </>\n"
            "  );\n"
            "}\n"
        ) % (css_import, ts_literal(metadata), COMPONENT[route],
             head_scripts, body_jsx)

        io.open(os.path.join(out_dir, "page.tsx"), "w",
                encoding="utf-8", newline="\n").write(page)
        report.append((src_name, "/" + route, len(body_jsx), len(css)))

    # The icon stylesheet was a plain <link> on every page. Scope it the same
    # way and let the site layout own it. No url() references, so moving it out
    # of /assets is safe.
    icons_src = os.path.join(APP_ROOT, "public", "assets", "icons", "icons.css")
    icons = io.open(icons_src, encoding="utf-8").read()
    io.open(os.path.join(styles_dir, "icons.css"), "w",
            encoding="utf-8", newline="\n").write(
        "/* Ported from assets/icons/icons.css. Scoped like the rest of the\n"
        "   site CSS. */\n\n" + scope_css(icons).strip() + "\n")

    # next/font generates a hashed family name, so the ported rules cannot name
    # the font literally any more.
    for f in sorted(os.listdir(styles_dir)):
        fp = os.path.join(styles_dir, f)
        css = io.open(fp, encoding="utf-8").read()
        if "'Plus Jakarta Sans'" in css:
            io.open(fp, "w", encoding="utf-8", newline="\n").write(
                css.replace("'Plus Jakarta Sans', sans-serif",
                            "var(--font-jakarta), sans-serif"))

    print("%-32s %-28s %9s %8s" % ("source", "route", "jsx", "css"))
    for r in report:
        print("%-32s %-28s %9d %8d" % r)


if __name__ == "__main__":
    main()
