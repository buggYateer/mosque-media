"""معاينة الموقع على جهازك:  python tools/serve.py   ← افتح http://localhost:8780
(بورت تاني: python tools/serve.py --port 8790)
- بيطبّق الإعدادات ويبني البيانات الأول (لو عايز تتخطى ده: --no-build)
- الصوت بيتشغّل من data/audio على جهازك، ولو الملف مش موجود (زي البيانات التجريبية) بيشغّل نغمة قصيرة مكانه
- الداشبورد (/lawha) مش بتشتغل هنا — محتاجة Vercel"""
import io
import json
import math
import re
import subprocess
import sys
import wave
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

for _s in (sys.stdout, sys.stderr):  # علشان العربي يظهر صح في شاشة ويندوز السودا
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
SITE = Path(__file__).resolve().parent.parent
AUDIO = SITE / "data" / "audio"
PORT = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 8780
TYPES = {".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav"}


def demo_tone(seed):
    """نغمة هادية 20 ثانية بدل الملف الناقص"""
    rate, sec = 8000, 20
    f1 = 220 + (seed % 7) * 30
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(1)
        w.setframerate(rate)
        w.writeframes(bytes(int(128 + 40 * math.sin(2 * math.pi * f1 * t / rate) * min(1, t / 4000, (rate * sec - t) / 4000)) for t in range(rate * sec)))
    return buf.getvalue()


def find_audio(i, part):
    for pat in (f"{i}_{part}.*", f"{i}.*") if part > 1 else (f"{i}.*", f"{i}_1.*"):
        f = next((x for x in AUDIO.glob(pat) if x.suffix.lower() in TYPES), None)
        if f:
            return f
    return None


class H(SimpleHTTPRequestHandler):
    def send_bytes(self, data, ctype, extra=()):
        size = len(data)
        start, end = 0, size - 1
        r = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if r and r.group(1):
            start = int(r.group(1))
            end = int(r.group(2)) if r.group(2) else size - 1
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        for k, v in extra:
            self.send_header(k, v)
        self.end_headers()
        try:
            self.wfile.write(data[start:end + 1])
        except (ConnectionResetError, BrokenPipeError):
            pass

    def audio(self, i, part, extra=()):
        f = find_audio(i, part)
        if f:
            return self.send_bytes(f.read_bytes(), TYPES[f.suffix.lower()], extra)
        return self.send_bytes(demo_tone(int(i) + part), "audio/wav", extra)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/api/dl":
            q = parse_qs(u.query)
            i, part = q.get("id", [""])[0], int(q.get("p", ["1"])[0] or 1)
            db = json.loads((SITE / "web" / "lessons.json").read_text(encoding="utf-8"))
            L = db["lessons"].get(i)
            if not L:
                return self.send_error(404)
            sh = next((x["name"] for x in db["sheikhs"] if x["key"] == L["s"]), "")
            name = L["t"] + (f" - الشيخ {sh}" if sh else "") + (f" ({part})" if L["p"] > 1 else "")
            return self.audio(i, part, [("Content-Disposition", f"attachment; filename=\"{i}.mp3\"; filename*=UTF-8''{quote(name + '.mp3')}")])
        m = re.match(r"^/audio/(\d+)(?:_(\d+))?\.mp3$", u.path)
        if m:
            return self.audio(m.group(1), int(m.group(2) or 1))
        if u.path.startswith("/api/"):
            return self.send_error(501, "API works on Vercel only")
        if u.path in ("/lawha", "/lawha/"):
            self.path = "/lawha/index.html"
        elif not Path(self.translate_path(u.path)).exists():
            self.path = "/index.html"  # صفحات الموقع (/s/...، /l/...) كلها من index.html
        return super().do_GET()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    if "--no-build" not in sys.argv:
        subprocess.run([sys.executable, str(SITE / "tools" / "apply_config.py")], check=True)
        subprocess.run([sys.executable, str(SITE / "tools" / "build_data.py")], check=True)
    ThreadingHTTPServer.allow_reuse_address = False  # لو البورت مشغول يقول بدل ما يشارك سيرفر تاني
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), partial(H, directory=str(SITE / "web")))
    except OSError:
        sys.exit(f"✗ البورت {PORT} مشغول — جرّب: python tools/serve.py --port {PORT + 10}")
    print(f"\n✓ الموقع شغال: http://localhost:{PORT}   (Ctrl+C للإيقاف)")
    srv.serve_forever()
