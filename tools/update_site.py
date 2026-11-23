"""التحديث الأسبوعي بخطوة واحدة:
  python tools/update_site.py --export "مسار فولدر التصدير"     (لو صدّرت الجديد من تليجرام ديسكتوب)
  python tools/update_site.py --bot                             (لو بتستخدم البوت)
  python tools/update_site.py                                   (من غير استيراد — بيبني وينشر بس)
بيعمل:
1) git pull (علشان ميكتبش فوق تعديلات الداشبورد)
2) يطبّق الإعدادات ويستورد الجديد ويجيب المشاهدات ويبني web/lessons.json
3) يرفع ملفات الصوت الجديدة بس على GitHub Releases باسم <رقم الرسالة>.mp3
4) commit + push ← Vercel ينشر الموقع لوحده خلال دقيقة
اختيارات زيادة: --dry (يوري هيعمل إيه بس) | --no-push (يرفع الصوت ويبني من غير نشر)"""
import json
import shutil
import subprocess
import sys
import tempfile
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
from build_data import audio_parts  # noqa: E402

DRY = "--dry" in sys.argv
UPLOADED = DATA / "uploaded.json"
PY = sys.executable


def run(*cmd, check=True):
    print("  $", " ".join(cmd))
    if DRY:
        return ""
    return subprocess.run(cmd, check=check, capture_output=True, text=True, encoding="utf-8", cwd=SITE).stdout


def tool(name, *args):
    subprocess.run([PY, str(SITE / "tools" / name), *args], check=True)


def need(cmd, hint):
    if not shutil.which(cmd):
        sys.exit(f"✗ البرنامج «{cmd}» مش متسطب. {hint}")


def main():
    need("git", "نزّله من https://git-scm.com")
    need("gh", "نزّله من https://cli.github.com وبعدها شغّل: gh auth login")
    cfg = load_config()
    repo = cfg["githubRepo"]
    if "YOUR_GITHUB_USERNAME" in repo:
        sys.exit("✗ لسه مكتبتش githubRepo في site.config.json")

    if not DRY:
        subprocess.run(["git", "pull", "--rebase", "--autostash", "-q"], cwd=SITE, check=False)
    tool("apply_config.py")
    if "--export" in sys.argv:
        tool("import_telegram_export.py", sys.argv[sys.argv.index("--export") + 1])
    if "--bot" in sys.argv:
        tool("fetch_bot.py")
    msgs = json.loads((DATA / "messages.json").read_text(encoding="utf-8"))
    if any(m.get("demo") for m in msgs):
        sys.exit("✗ البيانات لسه تجريبية — استورد قناتك الأول (--export أو --bot). شوف الدليل.")
    subprocess.run([PY, str(SITE / "tools" / "fetch_views.py")], check=False)
    tool("build_data.py")

    done = {str(k): v for k, v in (json.loads(UPLOADED.read_text(encoding="utf-8")) if UPLOADED.exists() else {}).items()}
    todo = [m["id"] for m in msgs if str(m["id"]) not in done and audio_parts(m["id"])]
    print(f"ملفات صوت جديدة للرفع: {len(todo)}")
    releases = set(run("gh", "release", "list", "-R", repo, "--limit", "200", "--json", "tagName", "-q", ".[].tagName", check=False).split())
    tmp = Path(tempfile.mkdtemp())
    try:
        for i in todo:
            tag = f"audio-{i // 500}"
            if tag not in releases:
                run("gh", "release", "create", tag, "-R", repo, "--title", f"صوتيات {tag}", "--notes", f"ملفات صوت موقع {cfg['name']}")
                releases.add(tag)
            parts = audio_parts(i)
            files = []
            for n, src in enumerate(parts, 1):
                dst = tmp / (f"{i}.mp3" if len(parts) == 1 else f"{i}_{n}.mp3")
                if not DRY:
                    if src.suffix.lower() == ".mp3" or not shutil.which("ffmpeg"):
                        shutil.copyfile(src, dst)
                    else:
                        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-c:a", "libmp3lame", "-b:a", "64k", str(dst)], check=True)
                files.append(str(dst))
            run("gh", "release", "upload", tag, *files, "-R", repo, "--clobber")
            done[str(i)] = len(parts)
            if not DRY:
                UPLOADED.write_text(json.dumps(done, indent=0), encoding="utf-8")
                for f in files:
                    Path(f).unlink(missing_ok=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # الموقع المنشور يشغّل بس اللي اترفع فعلًا
    p = SITE / "web" / "lessons.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    for k, L in data["lessons"].items():
        L["p"] = int(done.get(k, 0))
    if not DRY:
        p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    if "--no-push" in sys.argv:
        return print("✓ اتبنى من غير نشر (--no-push)")
    paths = [x for x in ("web", "api", "data", "site.config.json", "tools", "assets", "vercel.json", ".github", "README.md") if (SITE / x).exists()]
    run("git", "add", "-A", *paths, check=False)
    if run("git", "status", "--porcelain", check=False).strip() or DRY:
        run("git", "commit", "-m", "تحديث الموقع")
        run("git", "push")
    print("✓ تم — الموقع هيتحدث خلال دقيقة")


if __name__ == "__main__":
    main()
