"""يطبّق إعدادات المسجد (site.config.json) على ملفات الموقع.
python tools/apply_config.py

بيعمل:
- web/index.html و web/manifest.webmanifest و web/lawha/index.html من القوالب اللي في tools/templates
- web/site.js  (الاسم والقناة وأيام الدروس وألوان المشايخ — app.js بيقراه)
- web/theme.css (ألوانك وخطك وشكل الحواف)
- web/logo-mark.svg + الأيقونات — من لوجو مسجدك في assets/ (ولو مفيش: أول حرف من اسم المسجد مؤقتًا)
- api/_site.js (اسم المستودع والقناة لدوال Vercel)
بيتشغّل لوحده مع serve.py و update_site.py، فمش لازم تفتكره."""
import base64
import html
import json
import re
import shutil
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):  # علشان العربي يظهر صح في شاشة ويندوز السودا
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
SITE = Path(__file__).resolve().parent.parent
TPL = SITE / "tools" / "templates"
WEB = SITE / "web"

# الخطوط المتاحة (كلها مجانية من Google Fonts)
FONTS = {
    "Cairo": "Cairo:wght@400;600;700;800",
    "Tajawal": "Tajawal:wght@400;500;700;800",
    "Almarai": "Almarai:wght@400;700;800",
    "Noto Kufi Arabic": "Noto+Kufi+Arabic:wght@400;600;700;800",
    "Readex Pro": "Readex+Pro:wght@400;500;600;700",
    "El Messiri": "El+Messiri:wght@400;500;600;700",
    "Changa": "Changa:wght@400;500;600;700;800",
    "Rubik": "Rubik:wght@400;500;600;700;800",
}
CORNERS = {"sharp": "4px", "soft": "12px", "round": "22px"}

# هوية موقع مسجد الحسني محجوزة ليه — النسخة دي لازم تطلع بشكل مختلف
RESERVED_COLORS = ["#2e3f6b", "#1e2a4a", "#cfa64a", "#a8832f", "#26365e"]
RESERVED_FONTS = {"alexandria", "ibm plex sans arabic"}


def fail(msg):
    sys.exit("✗ " + msg)


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def too_close(a, b, limit=40):
    return sum((x - y) ** 2 for x, y in zip(rgb(a), rgb(b))) ** 0.5 < limit


def load_config():
    p = SITE / "site.config.json"
    try:
        cfg = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        fail(f"في غلطة في site.config.json (سطر {e.lineno}): {e.msg}\n  غالبًا فاصلة ناقصة أو زيادة، أو علامة \" ناقصة.")
    miss = [k for k in ("name", "telegramChannel", "githubRepo", "sheikhs") if not cfg.get(k)]
    if miss:
        fail("ناقص في site.config.json: " + "، ".join(miss))
    cfg.setdefault("shortName", cfg["name"])
    cfg.setdefault("description", f"دروس وخطب وتلاوات {cfg['name']}")
    cfg["domain"] = (cfg.get("domain") or "").rstrip("/")
    cfg["telegramChannel"] = cfg["telegramChannel"].lstrip("@").replace("https://t.me/", "").strip("/")

    c = cfg.setdefault("colors", {})
    c.setdefault("primary", "#0f766e")
    c.setdefault("highlight", "#f59e0b")
    c.setdefault("background", "#f7f7f5")
    c.setdefault("tones", ["#0f766e", "#7c3aed", "#b45309", "#be123c"])
    for k, v in list(c.items()):
        for x in (v if isinstance(v, list) else [v]):
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", x):
                fail(f"اللون «{x}» في colors.{k} لازم يبقى بالشكل ده: #0f766e")
            if any(too_close(x.lower(), r) for r in RESERVED_COLORS):
                fail(f"اللون «{x}» في colors.{k} قريب جدًا من ألوان موقع تاني — اختار لون يعبّر عن مسجدك انت.")

    d = cfg.setdefault("design", {})
    d.setdefault("font", "Cairo")
    d.setdefault("corners", "soft")
    d.setdefault("header", "light")
    if d["font"].lower() in RESERVED_FONTS:
        fail(f"الخط «{d['font']}» محجوز — اختار خط من دول: {'، '.join(FONTS)}")
    if d["font"] not in FONTS:
        fail(f"الخط «{d['font']}» مش في القايمة — اختار واحد من دول: {'، '.join(FONTS)}")
    if d["corners"] not in CORNERS:
        fail("design.corners لازم تبقى: sharp (حادة) أو soft (ناعمة) أو round (مدورة)")
    if d["header"] not in ("light", "colored"):
        fail("design.header لازم يبقى: light (فاتح) أو colored (بلون المسجد)")

    cfg["audioBase"] = (cfg.get("audioBase") or f"https://github.com/{cfg['githubRepo']}/releases/download").rstrip("/")
    for s in cfg["sheikhs"]:
        s.setdefault("name", s["key"].replace("_", " "))
    return cfg


def shade(hex_, f):
    """f<1 يغمّق، f>1 يفتّح"""
    r, g, b = rgb(hex_)
    if f < 1:
        r, g, b = (int(x * f) for x in (r, g, b))
    else:
        r, g, b = (int(x + (255 - x) * (f - 1)) for x in (r, g, b))
    return f"#{r:02x}{g:02x}{b:02x}"


def render(src, dst, vals, escape):
    s = (TPL / src).read_text(encoding="utf-8")
    s = re.sub(r"\{\{(\w+)\}\}", lambda m: escape(str(vals[m.group(1)])), s)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(s, encoding="utf-8")


def tone_class(cfg, s):
    n = len(cfg["colors"]["tones"])
    return f"t{(int(s.get('tone') or 1) - 1) % n + 1}"


def initial(name):
    """أول حرف من اسم المسجد (من غير «مسجد» و«ال») — لوجو مؤقت لحد ما تحط لوجو بتاعك"""
    w = re.sub(r"^(مسجد|جامع|مصلى)\s+", "", name.strip()).split()
    w = w[0] if w else name.strip()
    w = re.sub(r"^ال(?=..)", "", w)
    return (w[:1] or "م")


def font_file():
    for f in (Path("C:/Windows/Fonts/arialbd.ttf"), Path("C:/Windows/Fonts/tahomabd.ttf"), Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
              Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")):
        if f.exists():
            return str(f)
    return None


def make_icons(cfg, letter):
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        print("  (Pillow مش متسطبة — الأيقونات مش هتتعمل. سطّبها بـ: pip install pillow)")
        return
    c = cfg["colors"]
    own = SITE / "assets" / "logo.png"
    own_img = Image.open(own).convert("RGBA") if own.exists() else None
    ff = font_file()
    rad = {"sharp": 6, "soft": 14, "round": 30}[cfg["design"]["corners"]]

    def icon(size, full=False, inner=0.78):
        S = size * 4
        img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        if full:
            d.rectangle([0, 0, S, S], fill=c["primary"])
        else:
            d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * rad // 64, fill=c["primary"])
        if own_img:
            box = int(S * inner)
            lg = own_img.copy()
            lg.thumbnail((box, box), Image.LANCZOS)
            img.alpha_composite(lg, ((S - lg.width) // 2, (S - lg.height) // 2))
        elif ff:
            f = ImageFont.truetype(ff, int(S * inner * 0.72))
            d.text((S / 2, S / 2), letter, font=f, fill="#ffffff", anchor="mm")
        return img.resize((size, size), Image.LANCZOS)

    icon(192).save(WEB / "icon-192.png")
    icon(512).save(WEB / "icon-512.png")
    icon(180, full=True).convert("RGB").save(WEB / "apple-touch-icon.png")
    icon(32).save(WEB / "favicon-32.png")
    icon(512, full=True, inner=0.55).save(WEB / "icon-maskable.png")
    icon(256).save(WEB / "logo.png")
    og = Image.new("RGB", (1200, 630), c["primary"])
    lg = icon(360, full=True)
    og.paste(lg, (420, 135), lg)
    og.save(WEB / "og.png")


def main():
    cfg = load_config()
    c, d = cfg["colors"], cfg["design"]
    primary_d = shade(c["primary"], 0.78)
    vals = {k: v for k, v in cfg.items() if isinstance(v, str)}
    vals.update(primaryDark=primary_d, background=c["background"],
                fontUrl=f"https://fonts.googleapis.com/css2?family={FONTS[d['font']]}&display=swap")

    render("index.html", WEB / "index.html", vals, html.escape)
    render("lawha/index.html", WEB / "lawha" / "index.html", vals, html.escape)
    render("manifest.webmanifest", WEB / "manifest.webmanifest", vals, lambda s: json.dumps(s, ensure_ascii=False)[1:-1])

    # اللوجو: بتاع مسجدك من assets/، وإلا أول حرف من الاسم (مؤقت)
    letter = initial(cfg["name"])
    own_svg, own_png = SITE / "assets" / "logo.svg", SITE / "assets" / "logo.png"
    rx = {"sharp": 6, "soft": 14, "round": 30}[d["corners"]]
    box = f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64"><rect width="64" height="64" rx="{rx}" fill="{c["primary"]}"/>'
    if own_svg.exists() or own_png.exists():
        src = own_svg if own_svg.exists() else own_png
        mime = "image/svg+xml" if src.suffix == ".svg" else "image/png"
        data = f"data:{mime};base64," + base64.b64encode(src.read_bytes()).decode()
        if own_svg.exists():
            shutil.copyfile(own_svg, WEB / "logo-mark.svg")
        else:  # لوجو PNG: بنحطه جوه ملف svg علشان الصفحات تفضل بتشاور على نفس الملف
            (WEB / "logo-mark.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="{data}" width="64" height="64"/></svg>\n', encoding="utf-8")
        icon_svg = box + f'<image href="{data}" x="7" y="7" width="50" height="50"/></svg>\n'
    else:
        icon_svg = box + (f'<text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="{d["font"]},Tahoma,sans-serif" '
                          f'font-weight="800" font-size="36" fill="#fff">{html.escape(letter)}</text></svg>\n')
        (WEB / "logo-mark.svg").write_text(icon_svg, encoding="utf-8")
        print(f"  ℹ مفيش لوجو في assets/ — حطيت حرف «{letter}» مؤقتًا. حط لوجو مسجدك في assets/logo.png أو assets/logo.svg")
    (WEB / "icon.svg").write_text(icon_svg, encoding="utf-8")
    make_icons(cfg, letter)

    site = {
        "name": cfg["name"],
        "shortName": cfg["shortName"],
        "channel": cfg["telegramChannel"],
        "domain": cfg["domain"],
        "themeLight": c["primary"] if d["header"] == "colored" else c["background"],
        "themeDark": "#1b1c1e",
        "days": {s["key"]: s["day"] for s in cfg["sheikhs"] if s.get("day")},
        "tones": {s["key"]: tone_class(cfg, s) for s in cfg["sheikhs"]},
    }
    (WEB / "site.js").write_text(
        "/* بيتولد من site.config.json (python tools/apply_config.py) — متعدلش هنا */\n"
        f"window.SITE = {json.dumps(site, ensure_ascii=False, indent=1)};\n", encoding="utf-8")

    css = [f":root{{--primary:{c['primary']};--primary-d:{primary_d};--hl:{c['highlight']};--bg:{c['background']};"
           f"--tint:{shade(c['primary'], 1.88)};--r:{CORNERS[d['corners']]};--font:\"{d['font']}\",system-ui,sans-serif}}"]
    css.append(f":root[data-theme=\"dark\"]{{--tint:{shade(c['primary'], 0.3)}}}"
               f"@media (prefers-color-scheme:dark){{:root:not([data-theme=\"light\"]){{--tint:{shade(c['primary'], 0.3)}}}}}")
    if d["header"] == "colored":
        css.append(".top,.top .searchbar{--head-bg:var(--primary);--head-ink:#fff}.top .tg-btn{background:#fff;color:var(--primary)}.top .brand img{box-shadow:0 0 0 2px rgba(255,255,255,.75)}")
    for i, t in enumerate(c["tones"], 1):
        css.append(f".t{i}{{--tone:{t}}}")
    (WEB / "theme.css").write_text("/* بيتولد من site.config.json — متعدلش هنا */\n" + "\n".join(css) + "\n", encoding="utf-8")

    (SITE / "api" / "_site.js").write_text(
        "// بيتولد من site.config.json (python tools/apply_config.py) — متعدلش هنا\n"
        f"export const REPO = {json.dumps(cfg['githubRepo'])};\n"
        f"export const CHANNEL = {json.dumps(cfg['telegramChannel'])};\n"
        f"export const AUDIO_BASE = {json.dumps(cfg['audioBase'])};\n", encoding="utf-8")
    print(f"✓ الإعدادات اتطبقت: {cfg['name']} — t.me/{cfg['telegramChannel']} — خط {d['font']}")
    return cfg


if __name__ == "__main__":
    main()
