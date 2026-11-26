/**
 * Video and outside-audio links of a recording (lesson.vid / lesson.au).
 *   vid: a YouTube / Facebook / Google Drive link, any direct video link (…/x.mp4),
 *        or "file" = a video uploaded to the site's own store as <id>.mp4.
 *   au:  a direct link to an audio file kept somewhere else (it plays in the site's player).
 * Pure and small: used by the server, the player and the dashboard.
 */

/** Files the dashboard uploads: audio in any common format (the GitHub Action converts it to mp3), video (made into mp4). */
export const AUDIO_EXT = ["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac", "weba", "amr", "wma", "3gp"];
export const VIDEO_EXT = ["mp4", "mov", "m4v", "webm", "mkv", "avi", "3gp"];
export const AUDIO_MAX_MB = 500;
/** The lower-case extension of a file name («Lesson.M4A» → «m4a»). */
export const extOf = (name: string) => (/\.([a-z0-9]{2,4})$/i.exec(name)?.[1] ?? "").toLowerCase();

export type VideoSource = "youtube" | "facebook" | "drive" | "link" | "file";
export const VIDEO_SOURCES: VideoSource[] = ["youtube", "facebook", "drive", "link", "file"];

export type Video =
  | { source: "youtube"; id: string; start?: number; url: string }
  | { source: "facebook"; url: string }
  | { source: "drive"; id: string; url: string }
  | { source: "link" | "file"; url: string };

const YT_ID = /^[\w-]{11}$/;

function url(s: string): URL | null {
  try {
    const u = new URL(s.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/** «1h2m3s», «90», «1:30» → seconds. */
function seconds(t: string | null): number | undefined {
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  const n = m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
  return n || undefined;
}

/**
 * What a video link is. `fileUrl` is the address of an uploaded video ("file").
 * Returns null for something that isn't a usable link.
 */
export function parseVideo(src: string | undefined, fileUrl?: string): Video | null {
  if (!src) return null;
  if (src === "file") return fileUrl ? { source: "file", url: fileUrl } : null;
  const u = url(src);
  if (!u) return null;
  const host = u.hostname.replace(/^(www\.|m\.|mobile\.)/, "");
  if (host === "youtu.be" || host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
    const id = host === "youtu.be" ? u.pathname.slice(1) : (u.searchParams.get("v") ?? /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(u.pathname)?.[1] ?? "");
    if (!YT_ID.test(id)) return null;
    const start = seconds(u.searchParams.get("t") ?? u.searchParams.get("start"));
    return { source: "youtube", id, ...(start ? { start } : {}), url: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host.endsWith("facebook.com") || host === "fb.watch") return { source: "facebook", url: u.href };
  if (host === "drive.google.com" || host === "docs.google.com") {
    const id = /\/file\/d\/([\w-]{10,})/.exec(u.pathname)?.[1] ?? u.searchParams.get("id") ?? "";
    return /^[\w-]{10,}$/.test(id) ? { source: "drive", id, url: `https://drive.google.com/file/d/${id}/view` } : null;
  }
  return { source: "link", url: u.href };
}

/** Which kind of source a link is (for the dashboard), or null if it isn't a link. */
export const sourceOf = (src: string) => parseVideo(src, "x")?.source ?? null;

/** The page to open the video on its own site (when the embedded player can't play it). */
export const videoPageUrl = (v: Video) => v.url;

/** A direct audio link (https://…). */
export const isAudioLink = (s: string | undefined) => !!s && !!url(s);
