"""HTML -> JSX converter for the Mindelo marketing site port.

Deliberately conservative. It does not try to be a general-purpose converter:
it handles exactly the constructs these ten hand-written pages use, and raises
on anything it does not recognise rather than emitting subtly wrong JSX.
"""
import re
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}

# Attributes React spells differently. Anything not listed and not data-/aria-
# passes through unchanged.
ATTR = {
    "class": "className", "for": "htmlFor", "tabindex": "tabIndex",
    "readonly": "readOnly", "maxlength": "maxLength", "minlength": "minLength",
    "colspan": "colSpan", "rowspan": "rowSpan", "autocomplete": "autoComplete",
    "autofocus": "autoFocus", "autoplay": "autoPlay", "playsinline": "playsInline",
    "novalidate": "noValidate", "enterkeyhint": "enterKeyHint", "srcset": "srcSet",
    "crossorigin": "crossOrigin", "contenteditable": "contentEditable",
    "spellcheck": "spellCheck", "frameborder": "frameBorder",
    "allowfullscreen": "allowFullScreen", "datetime": "dateTime",
    "usemap": "useMap", "accept-charset": "acceptCharset",
    "http-equiv": "httpEquiv", "inputmode": "inputMode", "charset": "charSet",
    "referrerpolicy": "referrerPolicy", "formaction": "formAction",
    "accesskey": "accessKey", "srcdoc": "srcDoc", "srclang": "srcLang",
    "itemprop": "itemProp", "itemscope": "itemScope", "itemtype": "itemType",
    "itemid": "itemID", "hreflang": "hrefLang", "viewbox": "viewBox",
    "preserveaspectratio": "preserveAspectRatio", "patternunits": "patternUnits",
    "gradientunits": "gradientUnits", "gradienttransform": "gradientTransform",
    "markerwidth": "markerWidth", "markerheight": "markerHeight",
    "refx": "refX", "refy": "refY", "markerunits": "markerUnits",
    "spreadmethod": "spreadMethod", "clippathunits": "clipPathUnits",
    "maskunits": "maskUnits", "maskcontentunits": "maskContentUnits",
    "basefrequency": "baseFrequency", "numoctaves": "numOctaves",
    "stddeviation": "stdDeviation", "filterunits": "filterUnits",
    "textlength": "textLength", "lengthadjust": "lengthAdjust",
    # SVG
    "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap",
    "stroke-linejoin": "strokeLinejoin", "stroke-dasharray": "strokeDasharray",
    "stroke-dashoffset": "strokeDashoffset", "stroke-miterlimit": "strokeMiterlimit",
    "stroke-opacity": "strokeOpacity", "fill-rule": "fillRule",
    "fill-opacity": "fillOpacity", "clip-rule": "clipRule", "clip-path": "clipPath",
    "stop-color": "stopColor", "stop-opacity": "stopOpacity",
    "text-anchor": "textAnchor", "font-size": "fontSize",
    "font-family": "fontFamily", "font-weight": "fontWeight",
    "letter-spacing": "letterSpacing", "dominant-baseline": "dominantBaseline",
    "vector-effect": "vectorEffect", "marker-end": "markerEnd",
    "marker-start": "markerStart", "xlink:href": "xlinkHref",
    "color-interpolation-filters": "colorInterpolationFilters",
    "flood-color": "floodColor", "flood-opacity": "floodOpacity",
    "paint-order": "paintOrder",
}

# React's prop types declare these as numbers, so an all-digit value has to be
# emitted as a numeric literal rather than a string. Values like "100%" stay
# strings and are left alone.
NUMERIC = {"rows", "cols", "size", "span", "start", "maxLength", "minLength",
           "tabIndex", "width", "height", "colSpan", "rowSpan"}

# Valueless attributes React wants as booleans.
BOOL = {"disabled", "required", "checked", "selected", "autoplay", "muted",
        "loop", "playsinline", "async", "defer", "hidden", "open", "multiple",
        "readonly", "novalidate", "controls", "reversed", "itemscope",
        "allowfullscreen", "autofocus", "default", "nomodule", "inert"}


def css_prop_to_js(prop):
    prop = prop.strip()
    if prop.startswith("--"):
        return prop  # custom properties keep their literal name
    parts = prop.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def js_string(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ") + '"'


def style_to_jsx(value):
    """color:red;font-size:12px  ->  {{color: "red", fontSize: "12px"}}"""
    out = []
    custom = False
    for decl in value.split(";"):
        if not decl.strip():
            continue
        if ":" not in decl:
            raise ValueError("unparsable style declaration: " + repr(decl))
        prop, val = decl.split(":", 1)
        key = css_prop_to_js(prop)
        if not re.match(r"^[A-Za-z][A-Za-z0-9]*$", key):
            key = js_string(prop.strip())
            custom = True
        out.append(key + ": " + js_string(val.strip()))
    obj = "{" + ", ".join(out) + "}"
    if custom:
        return "{" + obj + " as React.CSSProperties}"
    return "{" + obj + "}"


def escape_text(t):
    """Text nodes: braces are JSX syntax, so they have to be neutralised."""
    return t.replace("{", "&#123;").replace("}", "&#125;")


class ToJSX(HTMLParser):
    def __init__(self):
        # convert_charrefs=False keeps &amp; &nbsp; etc. exactly as written,
        # which JSX renders identically and which keeps the token diff honest.
        super().__init__(convert_charrefs=False)
        self.out = []
        self.stack = []
        self.script_depth = 0  # inside <script>, content is raw JS, not markup
        self.style_depth = 0
        self.scripts = []      # [attrs, [chunks]] collected, not emitted
        self.styles = []

    def emit(self, s):
        self.out.append(s)

    def fmt_attrs(self, attrs):
        parts = []
        for name, value in attrs:
            lname = name.lower()
            if lname.startswith("data-") or lname.startswith("aria-"):
                jsx = lname
            else:
                jsx = ATTR.get(lname, lname)
            if lname.startswith("on"):
                if value and value.replace(" ", "") == "event.stopPropagation()":
                    # Re-attached by a delegated listener in the page script.
                    parts.append('data-stop-propagation=""')
                    continue
                raise ValueError(
                    "inline handler needs a decision: %s=%r" % (lname, value))
            if value is None:
                parts.append(jsx if lname in BOOL else jsx + '=""')
                continue
            if lname == "style":
                parts.append("style=" + style_to_jsx(value))
            elif jsx in NUMERIC and re.match(r"^\d+$", value.strip()):
                parts.append(jsx + "={" + value.strip() + "}")
            else:
                parts.append(jsx + "=" + js_string(value))
        return (" " + " ".join(parts)) if parts else ""

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self.script_depth += 1
            self.scripts.append([dict(attrs), []])
            # Leave a marker so the caller can splice the script back in at the
            # exact spot it occupied. Position matters: these scripts run at
            # parse time and expect the DOM above them to already exist.
            self.emit("@@SCRIPT%d@@" % (len(self.scripts) - 1))
            return
        if tag == "style":
            self.style_depth += 1
            self.styles.append([])
            self.emit("@@STYLE%d@@" % (len(self.styles) - 1))
            return
        a = self.fmt_attrs(attrs)
        if tag in VOID:
            self.emit("<" + tag + a + " />")
        else:
            self.emit("<" + tag + a + ">")
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.emit("<" + tag + self.fmt_attrs(attrs) + " />")

    def handle_endtag(self, tag):
        if tag == "script":
            self.script_depth -= 1
            return
        if tag == "style":
            self.style_depth -= 1
            return
        if tag in VOID:
            return  # stray </br> and friends
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
            self.emit("</" + tag + ">")
        elif tag in self.stack:
            # unclosed inner tags: close them so the JSX stays balanced
            while self.stack and self.stack[-1] != tag:
                self.emit("</" + self.stack.pop() + ">")
            self.stack.pop()
            self.emit("</" + tag + ">")
        # a close tag with no matching open is dropped

    def handle_data(self, data):
        if self.script_depth:
            self.scripts[-1][1].append(data)
            return
        if self.style_depth:
            self.styles[-1].append(data)
            return
        self.emit(escape_text(data))

    def handle_entityref(self, name):
        if self.script_depth:
            self.scripts[-1][1].append("&" + name + ";")
            return
        if self.style_depth:
            self.styles[-1].append("&" + name + ";")
            return
        self.emit("&" + name + ";")

    def handle_charref(self, name):
        if self.script_depth:
            self.scripts[-1][1].append("&#" + name + ";")
            return
        if self.style_depth:
            self.styles[-1].append("&#" + name + ";")
            return
        self.emit("&#" + name + ";")

    def handle_comment(self, data):
        if self.script_depth or self.style_depth:
            return
        self.emit("{/*" + data.replace("*/", "*\\/") + "*/}")

    def handle_decl(self, decl):
        pass


def convert(html_fragment):
    """Returns (jsx, scripts, styles). Scripts and styles are pulled out of the
    markup so the caller can decide where they belong."""
    p = ToJSX()
    p.feed(html_fragment)
    p.close()
    while p.stack:
        p.emit("</" + p.stack.pop() + ">")
    scripts = [(a, "".join(c)) for a, c in p.scripts]
    styles = ["".join(c) for c in p.styles]
    return "".join(p.out), scripts, styles
