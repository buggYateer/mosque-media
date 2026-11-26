"""يبني web/lessons.json (بيانات الموقع كلها) من:
- data/messages.json : مقاطع القناة (بيتملى بـ import_telegram_export.py أو fetch_bot.py)
- data/series.json   : السلاسل (بتكتبها بإيدك — شوف الدليل)
- data/views.json    : عدد المشاهدات (fetch_views.py) — اختياري
- site.config.json   : المشايخ وأنواع المقاطع والمجموعات
python tools/build_data.py

ملحوظة: تعديلات الداشبورد (/lawha) مش هنا — بتتحفظ في web/overrides.json والموقع بيطبقها فوق lessons.json."""
import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path

for _s in (sys.stdout, sys.stderr):  # علشان العربي يظهر صح في شاشة ويندوز السودا
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
SITE = Path(__file__).resolve().parent.parent
DATA = SITE / "data"
AUDIO = DATA / "audio"
sys.path.insert(0, str(SITE / "tools"))
from apply_config import load_config, types_of  # noqa: E402


def read_json(p, default):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def norm(s):
    s = re.sub(r"[ً-ْـ]", "", s or "")
    s = re.sub(r"[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("_", " ")
    return re.sub(r"\s+", " ", s).strip()


def plain(h):
    return html.unescape(re.sub(r"<[^>]+>", "", h or ""))


# ---------- التاريخ الهجري (حساب تقريبي ± يوم لو مفيش تاريخ مكتوب في الوصف أو اسم الملف) ----------
def to_hijri(dt):
    a = (14 - dt.month) // 12
    y = dt.year + 4800 - a
    m = dt.month + 12 * a - 3
    jd = dt.day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    L = jd - 1948440 + 10632
    n = (L - 1) // 10631
    L = L - 10631 * n + 354
    j = ((10985 - L) // 5316) * ((50 * L) // 17719) + (L // 5670) * ((43 * L) // 15238)
    L = L - ((30 - j) // 15) * ((17719 * j) // 50) - (j // 16) * ((15238 * j) // 43) + 29
    hm = (24 * L) // 709
    hd = L - (709 * hm) // 24
    hy = 30 * n + j - 30
    return f"{hd}-{hm}-{hy}"


def to_hijri_adjusted(dt):
    """الهجري مع فرق الأيام اللي المسجد حدده (site.config.json → dates.hijriOffset)."""
    from datetime import timedelta
    return to_hijri(dt + timedelta(days=HIJRI_OFFSET))


def hijri_of(m, text):
    for s in (m.get("file", ""), m.get("title", ""), text):
        r = re.search(r"(\d{1,2})-(\d{1,2})-(14\d\d)", s or "")
        if r and 1 <= int(r.group(2)) <= 12:
            return f"{int(r.group(1))}-{int(r.group(2))}-{r.group(3)}"
    if m.get("date"):
        try:
            return to_hijri_adjusted(datetime.fromisoformat(m["date"][:19]))
        except ValueError:
            pass
    return ""


def title_of(m, text):
    first = next((ln.strip() for ln in text.split("\n") if ln.strip()), "")
    first = re.sub(r"^[^\w#«(\"]+", "", first)  # إيموجي في الأول
    if "|" in first:
        first = first.split("|", 1)[1]
    first = re.sub(r"(\s+#\S+)+\s*$", "", first)  # هاشتاجات في آخر السطر
    # اسم الشيخ في آخر العنوان («— الشيخ فلان» أو «الشيخ فلان الفلاني») — الشيخ بيظهر لوحده في الموقع
    first = re.sub(r"\s*[—–-]\s*(?:ال|لل)?شيخ\s.*$", "", first)
    first = re.sub(r"\s+(?:ال|لل)شيخ\s+\S+(?:\s+\S+)?\s*$", "", first)
    t = re.sub(r"#(\S+)", lambda g: g.group(1).replace("_", " "), first).strip(" -–—:")
    if not t:
        t = m.get("title") or re.sub(r"\.\w{2,4}$", "", m.get("file", "")) or f"مقطع {m['id']}"
    return t[:200]


CFG = load_config()
HIJRI_OFFSET = CFG.get("dates", {}).get("hijriOffset", 0)
# أنواع المحتوى من site.config.json → types (أو الأساسية: تلاوة، درس، خطبة، متفرقات)
TYPES, DEFAULT_TYPE = types_of(CFG)


def kind_of(m, text):
    s = norm(text + " " + m.get("file", "") + " " + m.get("title", ""))
    for k, words in TYPES:
        if k != DEFAULT_TYPE and any(norm(w) in s for w in words):
            return k
    return DEFAULT_TYPE


BUILTIN_LABELS = {"lesson": "دروس", "khutba": "خطب", "tilawa": "تلاوات", "other": "أخرى"}


def type_label(k):
    """اسم النوع للرسايل اللي بتطلع في الشاشة."""
    t = next((x for x in CFG.get("types") or [] if x.get("key") == k), {})
    p = t.get("plural")
    return (p if isinstance(p, str) else (p or {}).get("ar") or next(iter((p or {}).values()), None)) or BUILTIN_LABELS.get(k, k)


def gregorian_of(m):
    """تاريخ النشر الميلادي «yyyy-mm-dd» (من التليجرام)."""
    d = (m.get("date") or "")[:10]
    return d if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) else ""


SHEIKHS = CFG["sheikhs"]
# كلمات بتسبق اسم الشيخ في الوصف، بكل لغة (من site.config.json → sheikhPrefixes)
PREFIXES = CFG.get("sheikhPrefixes") or ["الشيخ", "ش"]
PREFIX_RE = "|".join(re.escape(norm(x)) + (r"\.?" if len(x) <= 2 else "") for x in sorted(PREFIXES, key=len, reverse=True))
# لاكتشاف شيخ مش في الإعدادات بنستخدم الكلمات الطويلة بس (علشان «ش» لوحدها متمسكش أي كلمة)
PREFIX_LONG_RE = "|".join(re.escape(x) for x in sorted((x for x in PREFIXES if len(x) >= 3), key=len, reverse=True)) or "الشيخ"


def sheikh_of(m, text):
    s = " " + norm(text + " " + m.get("file", "") + " " + m.get("title", "")) + " "
    # 1) الاسم الكامل من الإعدادات
    for sh in SHEIKHS:
        if " " + norm(sh["name"]) + " " in s or norm(sh["key"]) in s:
            return sh["key"]
    # 2) الاسم المختصر بعد كلمة زي «الشيخ» أو «ش» أو «مولانا» أو «Шейх» (sheikhPrefixes في الإعدادات) أو هاشتاج
    for sh in SHEIKHS:
        for a in sh.get("aliases", []):
            if re.search(r"(?:" + PREFIX_RE + r"|#)\s*" + re.escape(norm(a)) + r"(?:\s|$)", s):
                return sh["key"]
    # 3) شيخ مش في الإعدادات: «الشيخ فلان الفلاني»
    r = re.search(r"(?:للشيخ|" + PREFIX_LONG_RE + r")\s+#?(\S+)[ _](\S+)", text, re.IGNORECASE)
    if r:
        return f"{r.group(1)}_{r.group(2)}".strip(" –-.,،")
    return ""


def audio_parts(i):
    """ملفات الصوت المحلية للمقطع: data/audio/<id>.mp3 أو <id>_1.mp3, <id>_2.mp3 ..."""
    one = [f for f in AUDIO.glob(f"{i}.*") if f.suffix.lower() in (".mp3", ".m4a", ".ogg", ".oga", ".opus", ".wav", ".aac")]
    if one:
        return [one[0]]
    parts = []
    n = 1
    while True:
        f = next((x for x in AUDIO.glob(f"{i}_{n}.*")), None)
        if not f:
            return parts
        parts.append(f)
        n += 1


# ---------- تحويل اسم الشيخ بالعربي لرابط إنجليزي ----------
CH = dict(zip("ابتثجحخدذرزسشصضطظعغفقكلمنهوي", ["a", "b", "t", "th", "g", "h", "kh", "d", "z", "r", "z", "s", "sh", "s", "d", "t", "z", "a", "gh", "f", "k", "k", "l", "m", "n", "h", "w", "y"]))
CH.update({"أ": "a", "إ": "e", "آ": "a", "ة": "a", "ى": "a", "ئ": "e", "ؤ": "o", "ء": ""})
WORDS = {"محمد": "mohamed", "أحمد": "ahmed", "محمود": "mahmoud", "عبدالله": "abdallah", "إبراهيم": "ibrahim", "يوسف": "youssef",
         "خالد": "khaled", "حسن": "hassan", "حسين": "hussein", "علي": "ali", "عمر": "omar", "مصطفى": "mostafa", "غير": "unknown", "محدد": ""}


def slugify(key):
    parts = [WORDS.get(w) or "".join(CH.get(c, c if c.isascii() and c.isalnum() else "") for c in w) for w in key.split("_")]
    return "-".join(x for x in parts if x).lower() or "sheikh"


def main():
    msgs = read_json(DATA / "messages.json", [])
    if not msgs:
        print("مفيش مقاطع في data/messages.json — استورد القناة الأول (شوف الدليل).")
    uploaded = read_json(DATA / "uploaded.json", {})
    views = read_json(DATA / "views.json", {})
    series_def = read_json(DATA / "series.json", {}).get("series", [])

    lessons, texts = {}, {}
    for m in sorted(msgs, key=lambda x: x["id"]):
        text = plain(m.get("text", ""))
        texts[m["id"]] = norm(" ".join([text, m.get("file", ""), m.get("title", "")]))
        local = len(audio_parts(m["id"]))
        L = {
            "t": m.get("siteTitle") or title_of(m, text),
            "s": m.get("sheikh") or sheikh_of(m, text),
            "k": m.get("kind") or kind_of(m, text),
            "d": m.get("dur", ""),
            "h": hijri_of(m, text),
            **({"g": gregorian_of(m)} if gregorian_of(m) else {}),
            "p": max(local, int(uploaded.get(str(m["id"]), 0)), 1 if m.get("demo") else 0),
        }
        if str(m["id"]) in views:
            L["v"] = views[str(m["id"])]
        lessons[m["id"]] = L

    # ---------- المجموعات (زي ليالي رمضان): كل مقطع فيه كلمة البحث ----------
    collections, in_coll = [], set()
    for c in CFG.get("collections", []):
        ids = [i for i in sorted(lessons) if c.get("match") and norm(c["match"]) in texts[i]] + [i for i in c.get("ids", []) if i in lessons]
        ids = sorted(set(ids))
        in_coll |= set(ids)
        collections.append({"key": c["key"], "title": c["title"], "label": c.get("label", c["title"]), "icon": c.get("icon", "bedtime"), "ids": ids})

    # ---------- السلاسل ----------
    in_series, series_by_sheikh = set(), {}

    def resolve(items, match):
        ids = []
        for it in items or []:
            i, t = (it[0], it[1]) if isinstance(it, list) else (it, None)
            if i in lessons:
                ids.append(i)
                if t:
                    lessons[i]["t"] = t
        if match:
            ids += [i for i in sorted(lessons) if norm(match) in texts[i] and i not in ids]
        return ids

    for s in series_def:
        secs, n = [], 0
        for sec in s.get("sections") or [{"t": "", "ids": s.get("ids", []), "match": s.get("match")}]:
            ids = resolve(sec.get("ids"), sec.get("match"))
            for i in ids:
                n += 1
                lessons[i]["k"] = DEFAULT_TYPE
                if s.get("numbered"):
                    lessons[i]["n"] = n
                in_series.add(i)
            if ids:
                secs.append({"t": sec.get("t", ""), "ids": ids})
        if secs:
            series_by_sheikh.setdefault(s["sheikh"], []).append({"key": s["key"], "title": s["title"], "sections": secs})

    # ---------- المشايخ ----------
    blank = lambda key, name=None: {"key": key, "name": name or key.replace("_", " "), "lesson": [], "khutba": [], "tilawa": [], "other": []}
    sheikhs = {sh["key"]: blank(sh["key"], sh["name"]) for sh in SHEIKHS}
    for i in sorted(lessons):
        L = lessons[i]
        key = L["s"] or "غير_محدد"
        L["s"] = key
        sh = sheikhs.setdefault(key, blank(key))
        if i not in in_series and i not in in_coll:
            sh.setdefault(L["k"], []).append(i)
    for key, ser in series_by_sheikh.items():
        sheikhs.setdefault(key, blank(key))["series"] = ser

    conf = {sh["key"]: sh for sh in SHEIKHS}
    order = [sh["key"] for sh in SHEIKHS]
    total = lambda sh: sum(len(v) for v in sh.values() if isinstance(v, list) and v and isinstance(v[0], int)) + sum(len(x["ids"]) for se in sh.get("series", []) for x in se["sections"])
    out_sheikhs, used = [], set()
    for sh in sheikhs.values():
        c = conf.get(sh["key"], {})
        sh["main"] = bool(c.get("main"))
        for ext in ("jpg", "jpeg", "png", "webp"):
            if (SITE / "public" / "img" / "sheikhs" / f"{sh['key']}.{ext}").exists():
                sh["img"] = f"img/sheikhs/{sh['key']}.{ext}"
                break
        sl = c.get("slug") or slugify(sh["key"])
        while sl in used:
            sl += "-2"
        used.add(sl)
        sh["slug"] = sl
        if total(sh) or sh["main"]:
            out_sheikhs.append(sh)
    out_sheikhs.sort(key=lambda sh: (0, order.index(sh["key"])) if sh["main"] else (1, -total(sh)))

    out = {
        "channel": CFG["telegramChannel"],
        "audioBase": CFG["audioBase"],
        "sheikhs": out_sheikhs,
        "collections": [c for c in collections if c["ids"]],
        "lessons": {str(k): v for k, v in lessons.items()},
    }
    if any(m.get("demo") for m in msgs):
        out["demo"] = True
    (SITE / "content").mkdir(exist_ok=True)
    (SITE / "content" / "lessons.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"✓ lessons.json: {len(lessons)} مقطع | في سلاسل: {len(in_series)} | مشايخ: {len(out_sheikhs)}")
    for sh in out_sheikhs:
        counts = " · ".join(f"{type_label(k)} {len(sh.get(k, []))}" for k, _ in TYPES)
        print(f"   {sh['name']}: سلاسل {len(sh.get('series', []))} · {counts}")
    unknown = [i for i in lessons if lessons[i]["s"] == "غير_محدد"]
    if unknown:
        print(f"   ⚠ {len(unknown)} مقطع من غير شيخ معروف (مثلًا {unknown[:5]}) — ضيف اسم الشيخ أو اسمه المختصر في site.config.json أو عدّلهم من الداشبورد")
    noaudio = [i for i in lessons if not lessons[i]["p"]]
    if noaudio:
        print(f"   ⚠ {len(noaudio)} مقطع ملوش ملف صوت (هيظهر بزرار تليجرام بس): {noaudio[:8]}")


if __name__ == "__main__":
    main()
