"""معالج الإعداد: بيسألك عن مسجدك وشكل الموقع اللي انت عايزه، ويكتب site.config.json.
python tools/setup.py

ممكن تشغّله أكتر من مرة — كل مرة بياخد إجاباتك القديمة كاختيار افتراضي (دوس Enter علشان تسيبها زي ما هي)."""
import json
import re
import subprocess
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):  # علشان العربي يظهر صح في شاشة ويندوز السودا
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
SITE = Path(__file__).resolve().parent.parent
CFG = SITE / "site.config.json"
sys.path.insert(0, str(SITE / "tools"))
from apply_config import CORNERS, FONTS, LOCALES, RESERVED_COLORS, too_close  # noqa: E402

PALETTES = [
    ("زيتوني ودهبي فاتح", "#4d7c0f", "#eab308", "#f8f8f2", ["#4d7c0f", "#0e7490", "#9a3412", "#6d28d9"]),
    ("تركواز وبرتقالي", "#0f766e", "#f59e0b", "#f7f7f5", ["#0f766e", "#7c3aed", "#b45309", "#be123c"]),
    ("بني دافي وكريمي", "#7c4a1e", "#d97706", "#faf6ef", ["#7c4a1e", "#3f6212", "#155e75", "#9f1239"]),
    ("بنفسجي وأصفر", "#6d28d9", "#facc15", "#f8f7fc", ["#6d28d9", "#0f766e", "#c2410c", "#be185d"]),
    ("عنابي وذهبي وردي", "#9f1239", "#fb923c", "#fbf7f7", ["#9f1239", "#1d4ed8", "#15803d", "#7e22ce"]),
    ("رمادي حديث وأخضر", "#52525b", "#22c55e", "#f5f6f8", ["#52525b", "#0f766e", "#a16207", "#be123c"]),
]


def ask(q, default=""):
    d = f" [{default}]" if default else ""
    v = input(f"\n{q}{d}\n> ").strip()
    return v or default


def choose(q, options, default=1):
    print(f"\n{q}")
    for i, o in enumerate(options, 1):
        print(f"  {i}) {o}")
    while True:
        v = input(f"اكتب الرقم [{default}]\n> ").strip() or str(default)
        if v.isdigit() and 1 <= int(v) <= len(options):
            return int(v) - 1
        print("  اكتب رقم من اللي فوق")


def ask_color(q, default):
    while True:
        v = ask(q + " (بالشكل ده #0f766e)", default).lower()
        if not re.fullmatch(r"#[0-9a-f]{6}", v):
            print("  اللون لازم يبقى # وبعدها 6 حروف/أرقام. تقدر تختار من https://htmlcolorcodes.com")
        elif any(too_close(v, r) for r in RESERVED_COLORS):
            print("  اللون ده قريب جدًا من ألوان موقع تاني — اختار لون يعبّر عن مسجدك انت")
        else:
            return v


def main():
    old = json.loads(CFG.read_text(encoding="utf-8")) if CFG.exists() else {}
    print("أهلًا! هنسألك كام سؤال عن مسجدك وشكل الموقع. دوس Enter لو عايز تسيب الاختيار اللي بين [ ].")

    cfg = dict(old)
    cfg["name"] = ask("اسم المسجد زي ما يظهر في الموقع؟", old.get("name", ""))
    cfg["shortName"] = ask("اسم قصير يظهر تحت أيقونة التطبيق (10 حروف تقريبًا)؟", old.get("shortName") or cfg["name"])
    cfg["description"] = ask("سطر يوصف الموقع (بيظهر في جوجل وواتساب)؟", old.get("description") or f"دروس وخطب وتلاوات {cfg['name']} — استمع من الموقع مباشرة")
    cfg["telegramChannel"] = ask("يوزر قناة التليجرام (من غير @)؟ — لو مالكش قناة اكتب - ", old.get("telegramChannel", "")).lstrip("@").replace("https://t.me/", "").strip("/")
    if cfg["telegramChannel"] in ("-", "لا", "مفيش"):
        cfg["telegramChannel"] = ""
    gh_user = ask("اسم حسابك على GitHub؟ (لو لسه معملتوش سيبه فاضي)", (old.get("githubRepo", "/").split("/")[0]).replace("YOUR_GITHUB_USERNAME", ""))
    repo = ask("اسم المستودع (الريبو) اللي هتعمله على GitHub؟", (old.get("githubRepo", "/masjed-site").split("/") + ["masjed-site"])[1] or "masjed-site")
    cfg["githubRepo"] = f"{gh_user or 'YOUR_GITHUB_USERNAME'}/{repo}"
    cfg["domain"] = ask("رابط الموقع؟ (لو لسه منشرتش على Vercel سيبه)", old.get("domain", ""))

    print("\n———— شكل الموقع ————")
    names = [f"{p[0]}   (أساسي {p[1]} · مميز {p[2]})" for p in PALETTES] + ["ألوان من عندي"]
    i = choose("اختار ألوان الموقع:", names, 2)
    if i < len(PALETTES):
        _, primary, hl, bg, tones = PALETTES[i]
    else:
        oc = old.get("colors", {})
        primary = ask_color("اللون الأساسي (الزراير والعناوين)", oc.get("primary", "#0f766e"))
        hl = ask_color("لون مميز (زرار «استمع» وشريط التقدم)", oc.get("highlight", "#f59e0b"))
        bg = ask_color("لون الخلفية (فاتح)", oc.get("background", "#f7f7f5"))
        tones = [primary] + [t for t in oc.get("tones", PALETTES[1][4])[1:]]
    cfg["colors"] = {"primary": primary, "highlight": hl, "background": bg, "tones": tones}

    fonts = list(FONTS)
    od = old.get("design", {})
    f = choose("اختار الخط (تقدر تشوف شكلهم على fonts.google.com):", fonts, fonts.index(od.get("font", "Cairo")) + 1 if od.get("font") in fonts else 1)
    c = choose("شكل الحواف (الكروت والزراير):", ["حادة", "ناعمة", "مدوّرة"], ["sharp", "soft", "round"].index(od.get("corners", "soft")) + 1)
    h = choose("الشريط اللي فوق:", ["فاتح (أبيض)", "بلون المسجد"], 2 if od.get("header") == "colored" else 1)
    cfg["design"] = {"font": fonts[f], "corners": list(CORNERS)[c], "header": ["light", "colored"][h]}

    print("\n———— اللغات ————")
    names = {"ar": "العربية", "en": "English", "ur": "اردو", "hi": "हिन्दी", "ru": "Русский"}
    oi = old.get("i18n", {})
    d = choose("لغة الموقع الأساسية:", [names[x] for x in LOCALES], LOCALES.index(oi.get("default", "ar")) + 1)
    extra = ask("لغات زيادة (اكتب الحروف مفصولة بمسافة: en ur hi ru) — أو Enter لو لغة واحدة بس", " ".join(x for x in oi.get("locales", []) if x != oi.get("default")))
    locs = [LOCALES[d]] + [x for x in extra.split() if x in LOCALES and x != LOCALES[d]]
    cfg["i18n"] = {"default": LOCALES[d], "locales": locs}

    print("\n———— التاريخ ————")
    cals = ["hijri", "gregorian", "both", "none"]
    od = old.get("dates", {})
    k = choose("التاريخ يظهر إزاي جنب كل مقطع؟", ["هجري", "ميلادي", "الاتنين (هجري · ميلادي)", "مايظهرش"], cals.index(od.get("calendar", "hijri")) + 1 if od.get("calendar") in cals else 1)
    cfg["dates"] = {**od, "calendar": cals[k]}

    print("\n———— المشايخ ————")
    if old.get("sheikhs") and input("\nتحب تكتب المشايخ من الأول؟ (ن/ل) [ل]\n> ").strip() not in ("ن", "نعم", "y", "yes"):
        pass
    else:
        sheikhs = []
        print("اكتب اسم كل شيخ (من غير كلمة «الشيخ»)، ولما تخلص دوس Enter على سطر فاضي.")
        while True:
            name = input(f"\nالشيخ رقم {len(sheikhs) + 1}:\n> ").strip()
            if not name:
                break
            name = re.sub(r"^(الشيخ|ش\.?)\s+", "", name)
            main = input("ليه درس أسبوعي ثابت في المسجد؟ (ن/ل) [ن]\n> ").strip() not in ("ل", "لا", "n", "no")
            day = input("يوم الدرس (مثلًا «درس الثلاثاء») — أو Enter للتخطي:\n> ").strip() if main else ""
            short = input("اسم مختصر بيتكتب في وصف المقاطع (مثلًا الاسم الأول) — أو Enter للتخطي:\n> ").strip()
            s = {"key": name.replace(" ", "_"), "name": name, "main": main, "tone": len(sheikhs) % len(tones) + 1}
            if day:
                s["day"] = day
            if short:
                s["aliases"] = [short]
            sheikhs.append(s)
        if sheikhs:
            cfg["sheikhs"] = sheikhs
    cfg.setdefault("sheikhs", [])
    cfg.setdefault("audioBase", "")
    cfg.setdefault("kinds", {"khutba": ["#خطبة_الجمعة", "خطبة"], "tilawa": ["تلاوة", "صلاة العشاء", "صلاة الفجر"], "other": ["أذان", "إعلان"]})
    cfg.setdefault("collections", [{"key": "ramadan", "title": "ليالي رمضان", "label": "التراويح والتهجد", "icon": "bedtime", "match": "رمضان"}])
    cfg.setdefault("ignore", [])

    cfg.setdefault("storage", {"data": {"provider": "github-json"}, "audio": {"provider": "github-releases"}})
    order = ["name", "shortName", "description", "domain", "telegramChannel", "githubRepo", "audioBase", "colors", "design", "i18n", "dates", "home", "storage", "sheikhs", "types", "kinds", "sheikhPrefixes", "collections", "texts", "ignore"]
    cfg = {k: cfg[k] for k in order if k in cfg} | {k: v for k, v in cfg.items() if k not in order}
    CFG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("\n✓ اتحفظ في site.config.json")
    subprocess.run([sys.executable, str(SITE / "tools" / "apply_config.py")])
    print("\nالخطوة الجاية: حط لوجو مسجدك في assets/logo.png (أو logo.svg)، وبعدها شغّل:  pnpm dev  وافتح http://localhost:3000")
    print("أنواع المحتوى (درس، خطبة، تلاوة، أو أنواع خاصة بيك)، وأقسام الصفحة الرئيسية، وأي كلمة في الموقع: بتتغيّر من site.config.json — شوف الدليل (docs/guide-ar.md).")


if __name__ == "__main__":
    main()
