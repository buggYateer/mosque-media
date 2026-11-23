"""يستورد مقاطع القناة من «تصدير» تليجرام ديسكتوب (Export chat history).
python tools/import_telegram_export.py "C:\\Users\\...\\Downloads\\Telegram Desktop\\ChatExport_2026-01-01"

إزاي تعمل التصدير (مرة أولى لكل القناة، وبعد كده كل أسبوع للجديد بس):
  تليجرام ديسكتوب ← افتح القناة ← ⋮ ← Export chat history
  ← علّم Audio files (و Voice messages لو بتسجل منه) ← Format: Machine-readable JSON
  ← (للتحديث الأسبوعي: From = آخر مرة صدّرت) ← Export
بيعمل:
- يضيف/يحدّث المقاطع في data/messages.json (أي بيانات تجريبية بتتمسح)
- ينسخ ملفات الصوت لـ data/audio/<رقم الرسالة>.mp3 (ولو الملف مش mp3 وعندك ffmpeg بيحوّله)"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):  # علشان العربي يظهر صح في شاشة ويندوز السودا
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
SITE = Path(__file__).resolve().parent.parent
DATA = SITE / "data"
AUDIO = DATA / "audio"


def text_of(t):
    if isinstance(t, str):
        return t
    return "".join(x if isinstance(x, str) else x.get("text", "") for x in t or [])


def fmt_dur(sec):
    sec = int(sec or 0)
    if not sec:
        return ""
    return f"{sec // 60}:{sec % 60:02d}" if sec < 3600 else f"{sec // 3600}:{sec % 3600 // 60:02d}:{sec % 60:02d}"


def is_audio(m):
    return m.get("media_type") in ("audio_file", "voice_message") or str(m.get("mime_type", "")).startswith("audio/")


def load_messages():
    p = DATA / "messages.json"
    msgs = json.loads(p.read_text(encoding="utf-8")) if p.exists() else []
    if any(m.get("demo") for m in msgs):
        print("  (مسحت البيانات التجريبية)")
        msgs = [m for m in msgs if not m.get("demo")]
        sp = DATA / "series.json"
        if sp.exists() and json.loads(sp.read_text(encoding="utf-8")).get("_demo"):
            sp.write_text(json.dumps({"series": []}, ensure_ascii=False, indent=1), encoding="utf-8")
    return msgs


def save_messages(msgs):
    (DATA / "messages.json").write_text(json.dumps(sorted(msgs, key=lambda m: m["id"]), ensure_ascii=False, indent=1), encoding="utf-8")


def store_audio(src, i):
    """ينسخ الملف لـ data/audio/<id>.mp3 (بيحوّل لو مش mp3 وffmpeg موجود)"""
    AUDIO.mkdir(parents=True, exist_ok=True)
    src = Path(src)
    ext = src.suffix.lower() or ".mp3"
    if ext != ".mp3" and shutil.which("ffmpeg"):
        dst = AUDIO / f"{i}.mp3"
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-c:a", "libmp3lame", "-b:a", "64k", str(dst)])
        if r.returncode == 0:
            return dst
    dst = AUDIO / f"{i}{ext}"
    if not dst.exists() or dst.stat().st_size != src.stat().st_size:
        shutil.copyfile(src, dst)
    return dst


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1].strip('"'))
    rj = folder / "result.json"
    if not rj.exists():
        sys.exit(f"✗ مش لاقي result.json في {folder}\n  اتأكد إنك اخترت Format: Machine-readable JSON وإنك مدّي الفولدر اللي فيه result.json")
    export = json.loads(rj.read_text(encoding="utf-8"))
    msgs = load_messages()
    by_id = {m["id"]: m for m in msgs}
    added = updated = nofile = 0
    for m in export.get("messages", []):
        if m.get("type") != "message" or not is_audio(m):
            continue
        i = m["id"]
        rec = by_id.get(i, {"id": i})
        is_new = i not in by_id
        rec.update({
            "date": m.get("date", rec.get("date", "")),
            "text": text_of(m.get("text")) or rec.get("text", ""),
            "title": " - ".join(x for x in (m.get("title"), m.get("performer")) if x) or rec.get("title", ""),
            "file": Path(m.get("file", "")).name if not str(m.get("file", "")).startswith("(") else rec.get("file", ""),
            "dur": fmt_dur(m.get("duration_seconds")) or rec.get("dur", ""),
        })
        f = folder / m.get("file", "")
        if m.get("file") and not str(m["file"]).startswith("(") and f.is_file():
            store_audio(f, i)
        elif not any(AUDIO.glob(f"{i}.*")):
            nofile += 1
        by_id[i] = rec
        added += is_new
        updated += not is_new
    save_messages(list(by_id.values()))
    print(f"✓ مقاطع جديدة: {added} | اتحدّثت: {updated} | من غير ملف صوت: {nofile}")
    if nofile:
        print("  ⚠ في مقاطع ملفها مش في التصدير — اتأكد إنك علّمت Audio files وإن حجم الملفات المسموح كبير كفاية (Size limit)")


if __name__ == "__main__":
    main()
