import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdmin } from "@/lib/admin/session";
import { AUDIO_EXT, AUDIO_MAX, BLOB_URL, VIDEO_EXT } from "@/lib/admin/uploads";
import { config } from "@/lib/config";

/**
 * Issues a short-lived upload permission so the browser can send a file straight to
 * Vercel Blob (files of any size; nothing passes through this server and no key leaves it).
 *   incoming/<id>.<ext>        audio   (<id>_<part> for a second part)
 *   incoming/<id>.video.<ext>  video
 * Needs a Blob store connected to the project (BLOB_READ_WRITE_TOKEN).
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "blob-not-configured" }, { status: 503 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await isAdmin())) throw new Error("signed-out");
        const m = /^incoming\/\d{1,7}(?:_\d{1,2})?(\.video)?\.([a-z0-9]{2,4})$/.exec(pathname);
        if (!m) throw new Error("bad-path");
        const video = !!m[1];
        if (!(video ? VIDEO_EXT : AUDIO_EXT).includes(m[2])) throw new Error("bad-type");
        return {
          allowedContentTypes: video ? ["video/*", "application/octet-stream"] : ["audio/*", "video/3gpp", "application/octet-stream"],
          maximumSizeInBytes: video ? config.media.maxUploadMB * 1024 * 1024 : AUDIO_MAX,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 400 });
  }
}

/** Removes a staged upload the admin dropped before publishing: DELETE {url}. */
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "signed-out" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ ok: true });
  const { url } = ((await req.json().catch(() => ({}))) ?? {}) as { url?: string };
  if (!url || !BLOB_URL.test(url) || !new URL(url).pathname.startsWith("/incoming/")) return Response.json({ error: "bad-url" }, { status: 400 });
  try {
    await del(url);
  } catch {}
  return Response.json({ ok: true });
}
