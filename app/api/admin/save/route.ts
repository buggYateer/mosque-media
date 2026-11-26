import { after } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin/session";
import { commitFiles } from "@/lib/admin/github";
import { AUDIO_EXT, BLOB_URL, cleanupStaged, VIDEO_EXT } from "@/lib/admin/uploads";
import { revalidateTag } from "next/cache";
import { getDataStore } from "@/lib/storage";
import { overridesSchema } from "@/lib/storage/types";

const bodySchema = z.object({
  overrides: overridesSchema,
  /** Files already uploaded to Vercel Blob from the browser, to be moved into the audio store. */
  uploads: z
    .array(
      z.object({
        id: z.number().int().positive(),
        url: z.url(),
        kind: z.enum(["audio", "video"]).default("audio"),
        ext: z.string().regex(/^[a-z0-9]{2,4}$/).default("mp3"),
      }),
    )
    .default([]),
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
  if (uploads.some((u) => !BLOB_URL.test(u.url) || !(u.kind === "video" ? VIDEO_EXT : AUDIO_EXT).includes(u.ext)))
    return Response.json({ error: "invalid-upload-url" }, { status: 400 });

  // Staged files are moved into the audio store by the GitHub Action (.github/workflows/incoming.yml):
  // incoming/<id>.json → <id>.mp3 (converted when needed), incoming/<id>.video.json → <id>.mp4
  const pointers = uploads.map((u) => ({
    path: `incoming/${u.id}${u.kind === "video" ? ".video" : ""}.json`,
    content: JSON.stringify({ id: u.id, url: u.url, kind: u.kind, ext: u.ext }) + "\n",
  }));
  try {
    const store = await getDataStore();
    if (store.name === "github-json") {
      // One commit (edits + audio pointers) → Vercel redeploys the site.
      await store.saveOverrides(overrides, "Dashboard update", pointers);
    } else {
      // Database: save, refresh the cached pages right away, and still commit the audio pointers for the Action.
      await store.saveOverrides(overrides, "Dashboard update");
      if (pointers.length) await commitFiles(pointers, "Dashboard audio");
      revalidateTag("library", "max");
    }
  } catch (e) {
    return Response.json({ error: "save-failed", detail: String(e) }, { status: 502 });
  }

  // after the answer: remove staged files older than 2 days (already moved by the GitHub Action)
  after(cleanupStaged);
  return Response.json({ ok: true });
}
