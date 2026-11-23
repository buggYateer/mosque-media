"""(اختياري) يجيب المقاطع الجديدة من القناة عن طريق البوت — بديل أسرع من التصدير للتحديث اليومي.
python tools/fetch_bot.py

قبلها (مرة واحدة):
  1) اعمل بوت من @BotFather وخد التوكن، وحطه في ملف data/bot_token.txt (الملف ده عمره ما بيترفع على GitHub)
  2) ضيف البوت «مشرف» (Admin) في القناة — من غير أي صلاحيات زيادة

حدود لازم تعرفها (من تليجرام نفسه):
  - البوت بيشوف الرسايل اللي اتنشرت بعد ما اتضاف بس، وتليجرام بيحتفظ بيها 24 ساعة بس
    ← شغّل السكريبت ده كل يوم (أو استخدم التصدير من تليجرام ديسكتوب كل أسبوع بدل منه)
  - البوت مش بيقدر ينزّل ملف أكبر من 20 ميجا ← المقطع بيتسجل، وملفه تجيبه من التصدير"""
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

for _s in (sys.stdout, sys.stderr):  # علشان العربي يظهر صح في شاشة ويندوز السودا
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
SITE = Path(__file__).resolve().parent.parent
DATA = SITE / "data"
sys.path.insert(0, str(SITE / "tools"))
from apply_config import load_config  # noqa: E402
from import_telegram_export import fmt_dur, load_messages, save_messages, AUDIO  # noqa: E402

STATE = DATA / "bot_state.json"


def token():
    t = os.environ.get("TELEGRAM_BOT_TOKEN") or ""
    p = DATA / "bot_token.txt"
    if not t and p.exists():
        t = p.read_text(encoding="utf-8").strip()
    if not t:
        sys.exit("✗ مفيش توكن: حط توكن البوت في data/bot_token.txt")
    return t


def api(tok, method, **params):
    url = f"https://api.telegram.org/bot{tok}/{method}?" + urllib.parse.urlencode({k: json.dumps(v) if isinstance(v, list) else v for k, v in params.items()})
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode("utf-8") or "{}")


def main():
    cfg = load_config()
    ch = cfg["telegramChannel"].lower()
    tok = token()
    me = api(tok, "getMe")
    if not me.get("ok"):
        sys.exit("✗ التوكن مش شغال — اتأكد إنك نسخته صح من @BotFather")
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    r = api(tok, "getUpdates", offset=state.get("offset", 0), timeout=0, allowed_updates=["channel_post", "edited_channel_post"])
    if not r.get("ok"):
        sys.exit(f"✗ {r.get('description')}  (لو البوت عليه webhook امسحه الأول: deleteWebhook)")
    msgs = load_messages()
    by_id = {m["id"]: m for m in msgs}
    added = big = 0
    for u in r["result"]:
        state["offset"] = u["update_id"] + 1
        p = u.get("channel_post") or u.get("edited_channel_post") or {}
        if (p.get("chat", {}).get("username") or "").lower() != ch:
            continue
        media = p.get("audio") or p.get("voice") or (p.get("document") if str(p.get("document", {}).get("mime_type", "")).startswith("audio/") else None)
        i = p["message_id"]
        if not media:
            if i in by_id and "caption" in p:  # تعديل وصف مقطع موجود
                by_id[i]["text"] = p["caption"]
            continue
        rec = by_id.get(i, {"id": i})
        added += i not in by_id
        rec.update({"text": p.get("caption", rec.get("text", "")), "file": media.get("file_name", rec.get("file", "")),
                    "title": " - ".join(x for x in (media.get("title"), media.get("performer")) if x) or rec.get("title", ""),
                    "dur": fmt_dur(media.get("duration")) or rec.get("dur", "")})
        rec.setdefault("date", __import__("datetime").datetime.fromtimestamp(p["date"]).isoformat())
        by_id[i] = rec
        if media.get("file_size", 0) > 20 * 1024 * 1024:
            big += 1
            print(f"  ⚠ المقطع {i} أكبر من 20 ميجا — هاته من التصدير (import_telegram_export.py)")
            continue
        f = api(tok, "getFile", file_id=media["file_id"])
        if f.get("ok"):
            ext = Path(f["result"]["file_path"]).suffix or ".mp3"
            AUDIO.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(f"https://api.telegram.org/file/bot{tok}/{f['result']['file_path']}", AUDIO / f"{i}{ext}")
    save_messages(list(by_id.values()))
    STATE.write_text(json.dumps(state), encoding="utf-8")
    print(f"✓ من البوت: {added} مقطع جديد" + (f" | {big} ملف كبير محتاج التصدير" if big else ""))


if __name__ == "__main__":
    main()
