import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { isAdmin } from "@/lib/admin/session";

/**
 * Issues a short-lived upload permission so the browser can send an audio file straight to
 * Vercel Blob (files of any size; nothing passes through this server and no key leaves it).
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
        if (!/^incoming\/\d{1,7}(_\d{1,2})?\.mp3$/.test(pathname)) throw new Error("bad-path");
        return { allowedContentTypes: ["audio/mpeg", "audio/mp3"], maximumSizeInBytes: 300 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String((e as Error).message ?? e) }, { status: 400 });
  }
}
