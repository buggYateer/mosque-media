"""يتأكد إن site.config.json سليم (أدوات Python بتستعمله).
python tools/apply_config.py

في v2 الموقع (Next.js) بيقرا الإعدادات لوحده وهو بيتبني — الألوان والخط والأيقونات وكل حاجة —
فالملف ده بقى للتحقق بس، ونفس القواعد موجودة في lib/config.ts."""
import json
import re
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):  # علشان العربي يظهر صح في شاشة ويندوز السودا
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
SITE = Path(__file__).resolve().parent.parent

# الخطوط المتاحة (كلها مجانية من Google Fonts) — نفس القايمة في lib/config.ts و scripts/prepare.mjs
FONTS = ["Cairo", "Tajawal", "Almarai", "Noto Kufi Arabic", "Readex Pro", "El Messiri", "Changa", "Rubik"]
CORNERS = {"sharp": "4px", "soft": "12px", "round": "22px"}
LOCALES = ["ar", "en", "ur", "hi", "ru"]

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
    cfg["telegramChannel"] = cfg["telegramChannel"].lstrip("@").replace("https://t.me/", "").strip("/")
    c = cfg.setdefault("colors", {})
    for k, v in list(c.items()):
        for x in (v if isinstance(v, list) else [v]):
            if not re.fullmatch(r"#[0-9a-fA-F]{6}", x):
                fail(f"اللون «{x}» في colors.{k} لازم يبقى بالشكل ده: #0f766e")
            if any(too_close(x.lower(), r) for r in RESERVED_COLORS):
                fail(f"اللون «{x}» في colors.{k} قريب جدًا من ألوان موقع تاني — اختار لون يعبّر عن مسجدك انت.")
    d = cfg.setdefault("design", {})
    font = d.get("font", "Cairo")
    if font.lower() in RESERVED_FONTS or font not in FONTS:
        fail(f"الخط «{font}» مش متاح — اختار واحد من دول: {'، '.join(FONTS)}")
    i18n = cfg.setdefault("i18n", {"default": "ar", "locales": ["ar"]})
    bad = [x for x in i18n.get("locales", []) if x not in LOCALES]
    if bad or i18n.get("default") not in i18n.get("locales", []):
        fail(f"i18n: اللغات المتاحة {', '.join(LOCALES)}، و default لازم يكون واحدة من locales")
    cfg["audioBase"] = (cfg.get("audioBase") or f"https://github.com/{cfg['githubRepo']}/releases/download").rstrip("/")
    for s in cfg["sheikhs"]:
        s.setdefault("name", s["key"].replace("_", " "))
    return cfg


def main():
    cfg = load_config()
    print(f"✓ site.config.json سليم: {cfg['name']} — t.me/{cfg['telegramChannel']} — اللغات {', '.join(cfg['i18n']['locales'])}")
    return cfg


if __name__ == "__main__":
    main()
