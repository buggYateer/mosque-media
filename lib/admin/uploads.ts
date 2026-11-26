/** Files staged in Vercel Blob by the dashboard, before the GitHub Action moves them to the audio store. */
import { del, list } from "@vercel/blob";

import { AUDIO_EXT, AUDIO_MAX_MB, VIDEO_EXT } from "@/lib/media";

export { AUDIO_EXT, VIDEO_EXT };
export const AUDIO_MAX = AUDIO_MAX_MB * 1024 * 1024;
export const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;

/** Best effort: removes staged uploads older than 2 days (the GitHub Action moved them long ago, or they were never published). */
export async function cleanupStaged() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { blobs } = await list({ prefix: "incoming/" });
    const old = blobs.filter((b) => Date.now() - new Date(b.uploadedAt).getTime() > 2 * 86400_000).map((b) => b.url);
    if (old.length) await del(old);
  } catch {}
}
