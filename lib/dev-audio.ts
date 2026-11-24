/**
 * Audio for local previews and the demo: serves data/audio/<id>.* from this computer,
 * or a short gentle tone when the file is missing (demo data has no real audio).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const TYPES: Record<string, string> = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg", ".wav": "audio/wav" };

export function localAudio(id: number, part: number): { body: Uint8Array<ArrayBuffer>; type: string } {
  const dir = join(process.cwd(), "data", "audio");
  if (existsSync(dir)) {
    const files = readdirSync(dir);
    const want = part > 1 ? [`${id}_${part}.`] : [`${id}.`, `${id}_1.`];
    const hit = files.find((f) => want.some((w) => f.startsWith(w)) && TYPES[f.slice(f.lastIndexOf(".")).toLowerCase()]);
    if (hit) return { body: new Uint8Array(readFileSync(join(dir, hit))) as Uint8Array<ArrayBuffer>, type: TYPES[hit.slice(hit.lastIndexOf(".")).toLowerCase()] };
  }
  return { body: tone(id + part), type: "audio/wav" };
}

/** 20-second fading tone, 8 kHz mono 8-bit WAV (~160 KB). */
function tone(seed: number) {
  const rate = 8000,
    sec = 20,
    n = rate * sec,
    f = 220 + (seed % 7) * 30;
  const buf = new Uint8Array(44 + n);
  const v = new DataView(buf.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  str(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, "data");
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) buf[44 + i] = Math.round(128 + 40 * Math.sin((2 * Math.PI * f * i) / rate) * Math.min(1, i / 4000, (n - i) / 4000));
  return buf;
}
