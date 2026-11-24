import { del, list } from "@vercel/blob";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/session";
import { config } from "@/lib/config";
import { dataStore } from "@/lib/storage";
import { overridesSchema } from "@/lib/storage/types";

const bodySchema = z.object({
  overrides: overridesSchema,
  /** Audio files already uploaded to Vercel Blob from the browser, to be moved into the audio store. */
  uploads: z.array(z.object({ id: z.number().int().positive(), url: z.url() })).default([]),
});

/**
 * Publish dashboard edits. With the default stores, ONE commit contains:
 *  - content/overrides.json
 *  - incoming/<id>.json for each new audio file (GitHub Actions moves it to Releases)
 * Vercel then redeploys the site (about a minute).
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "signed-out" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid", detail: parsed.error.issues.slice(0, 3) }, { status: 400 });
  const { overrides, uploads } = parsed.data;
  const blobHost = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;
  if (uploads.some((u) => !blobHost.test(u.url))) return Response.json({ error: "invalid-upload-url" }, { status: 400 });

  const pointers = uploads.map((u) => ({ path: `incoming/${u.id}.json`, content: JSON.stringify({ id: u.id, url: u.url }) + "\n" }));
  try {
    await dataStore.saveOverrides(overrides, "Dashboard update", config.storage.audio.provider === "github-releases" ? pointers : []);
  } catch (e) {
    return Response.json({ error: "save-failed", detail: String(e) }, { status: 502 });
  }

  // Best effort: remove staged audio older than 2 days (already moved by GitHub Actions).
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { blobs } = await list({ prefix: "incoming/" });
      const old = blobs.filter((b) => Date.now() - new Date(b.uploadedAt).getTime() > 2 * 86400_000).map((b) => b.url);
      if (old.length) await del(old);
    } catch {}
  }
  return Response.json({ ok: true });
}
