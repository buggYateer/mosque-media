"""التحديث الأسبوعي بخطوة واحدة:
  python tools/update_site.py --export "مسار فولدر التصدير"     (لو صدّرت الجديد من تليجرام ديسكتوب)
  python tools/update_site.py --bot                             (لو بتستخدم البوت)
  python tools/update_site.py                                   (من غير استيراد — بيبني وينشر بس)
بيعمل:
1) git pull (علشان ميكتبش فوق تعديلات الداشبورد)
2) يتأكد من الإعدادات، يستورد الجديد، يجيب المشاهدات، ويبني content/lessons.json
3) يرفع ملفات الصوت الجديدة بس (GitHub Releases، أو S3/R2 لو اخترته في site.config.json)
4) لو البيانات في قاعدة بيانات: pnpm data:sync
5) commit + push ← Vercel ينشر الموقع لوحده خلال دقيقة
اختيارات زيادة: --dry (يوري هيعمل إيه بس) | --no-push (يرفع الصوت ويبني من غير نشر)"""
import json
import os
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
    return subprocess.run(cmd, check=check, capture_output=True, text=True, encoding="utf-8", cwd=SITE, shell=os.name == "nt" and cmd[0] == "pnpm").stdout


def tool(name, *args):
    subprocess.run([PY, str(SITE / "tools" / name), *args], check=True)


def need(cmd, hint):
    if not shutil.which(cmd):
        sys.exit(f"✗ البرنامج «{cmd}» مش متسطب. {hint}")


def to_mp3(src: Path, dst: Path):
    if src.suffix.lower() == ".mp3" or not shutil.which("ffmpeg"):
        shutil.copyfile(src, dst)
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-c:a", "libmp3lame", "-b:a", "64k", str(dst)], check=True)


def s3_client():
    """S3-compatible storage (Cloudflare R2, Backblaze B2, AWS …). Keys come from environment variables only."""
    try:
        import boto3  # noqa: WPS433
    except ImportError:
        sys.exit("✗ رفع الصوت على S3/R2 محتاج boto3:  pip install boto3")
    miss = [k for k in ("S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY") if not os.environ.get(k)]
    if miss:
        sys.exit("✗ ناقص متغيرات البيئة: " + "، ".join(miss) + " (حطها في الكمبيوتر، مش في أي ملف في المشروع)")
    return boto3.client("s3", endpoint_url=os.environ["S3_ENDPOINT"], aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
                        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"], region_name="auto")


def main():
    need("git", "نزّله من https://git-scm.com")
    cfg = load_config()
    repo = cfg["githubRepo"]
    storage = cfg.get("storage") or {}
    audio_provider = (storage.get("audio") or {}).get("provider", "github-releases")
    data_provider = (storage.get("data") or {}).get("provider", "github-json")
    if audio_provider == "github-releases":
        need("gh", "نزّله من https://cli.github.com وبعدها شغّل: gh auth login")
    if "YOUR_GITHUB_USERNAME" in repo:
        sys.exit("✗ لسه مكتبتش githubRepo في site.config.json")

    if not DRY:
        subprocess.run(["git", "pull", "--rebase", "--autostash", "-q"], cwd=SITE, check=False)
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
    print(f"ملفات صوت جديدة للرفع: {len(todo)} ← {audio_provider}")
    s3 = s3_client() if todo and audio_provider == "s3" and not DRY else None
    releases = set()
    if todo and audio_provider == "github-releases":
        releases = set(run("gh", "release", "list", "-R", repo, "--limit", "200", "--json", "tagName", "-q", ".[].tagName", check=False).split())
    tmp = Path(tempfile.mkdtemp())
    try:
        for i in todo:
            parts = audio_parts(i)
            files = []
            for n, src in enumerate(parts, 1):
                dst = tmp / (f"{i}.mp3" if len(parts) == 1 else f"{i}_{n}.mp3")
                if not DRY:
                    to_mp3(src, dst)
                files.append(dst)
            if audio_provider == "s3":
                for f in files:
                    print(f"  ↑ s3://{os.environ.get('S3_BUCKET', '?')}/{f.name}")
                    if s3:
                        s3.upload_file(str(f), os.environ["S3_BUCKET"], f.name, ExtraArgs={"ContentType": "audio/mpeg"})
            else:
                tag = f"audio-{i // 500}"
                if tag not in releases:
                    run("gh", "release", "create", tag, "-R", repo, "--title", f"Audio {tag}", "--notes", f"Audio files of {cfg['name']}")
                    releases.add(tag)
                run("gh", "release", "upload", tag, *map(str, files), "-R", repo, "--clobber")
            done[str(i)] = len(parts)
            if not DRY:
                UPLOADED.write_text(json.dumps(done, indent=0), encoding="utf-8")
                for f in files:
                    f.unlink(missing_ok=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    # الموقع المنشور يشغّل بس اللي اترفع فعلًا
    p = SITE / "content" / "lessons.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    for k, L in data["lessons"].items():
        L["p"] = int(done.get(k, 0))
    if not DRY:
        p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    if data_provider != "github-json":
        need("pnpm", "سطّب Node.js وبعدها: npm install -g pnpm")
        print(run("pnpm", "data:sync"))

    if "--no-push" in sys.argv:
        return print("✓ اتبنى من غير نشر (--no-push)")
    paths = [x for x in ("content", "data", "site.config.json", "assets") if (SITE / x).exists()]
    run("git", "add", "-A", *paths, check=False)
    if run("git", "status", "--porcelain", check=False).strip() or DRY:
        run("git", "commit", "-m", "Update")
        run("git", "push")
    print("✓ تم — الموقع هيتحدث خلال دقيقة")


if __name__ == "__main__":
    main()
