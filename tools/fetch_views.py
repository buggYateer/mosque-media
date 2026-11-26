"""يجيب عدد المشاهدات لكل مقطع من صفحة الرسالة العامة على تليجرام (t.me/<القناة>/<رقم>?embed=1)
ويحفظها في data/views.json — build_data بيستخدمها لقسم «الأكثر استماعًا».
python tools/fetch_views.py   (القناة لازم تكون عامة)"""
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

for _s in (sys.stdout, sys.stderr):  # علشان العربي يظهر صح في شاشة ويندوز السودا
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
SITE = Path(__file__).resolve().parent.parent
OUT = SITE / "data" / "views.json"
sys.path.insert(0, str(SITE / "tools"))
from apply_config import load_config  # noqa: E402

CH = load_config()["telegramChannel"]  # فاضي لو المسجد مالوش قناة


def parse(v):
    v = v.strip().upper().replace(",", "")
    mul = 1000 if v.endswith("K") else 1_000_000 if v.endswith("M") else 1
    try:
        return int(float(v.rstrip("KM")) * mul)
    except ValueError:
        return None


def views(i):
    try:
        req = urllib.request.Request(f"https://t.me/{CH}/{i}?embed=1&mode=tme", headers={"User-Agent": "Mozilla/5.0"})
        html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
        m = re.search(r'tgme_widget_message_views">([^<]+)<', html)
        return i, parse(m.group(1)) if m else None
    except Exception:
        return i, None


def main():
    if not CH:
        return print("مشاهدات: مفيش قناة تليجرام، اتخطّيت الخطوة دي")
    msgs = json.loads((SITE / "data" / "messages.json").read_text(encoding="utf-8"))
    ids = [m["id"] for m in msgs if not m.get("demo")]
    if not ids:
        return print("مشاهدات: مفيش مقاطع حقيقية لسه")
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    with ThreadPoolExecutor(8) as ex:
        res = dict(ex.map(views, ids))
    got = {str(k): v for k, v in res.items() if v is not None}
    old.update(got)
    OUT.write_text(json.dumps(old, indent=0), encoding="utf-8")
    print(f"مشاهدات: {len(got)} من {len(res)}")


if __name__ == "__main__":
    main()
