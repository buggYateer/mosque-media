/**
 * Audio providers: where the mp3 files live. Only the public URL matters to the website;
 * uploading is done by tools/update_site.py and the GitHub Action (.github/workflows/incoming.yml).
 */
import type { AudioStore } from "./types";

const fileName = (id: number, part: number, parts: number) => (parts > 1 ? `${id}_${part}.mp3` : `${id}.mp3`);

/** Default: GitHub Releases — audio-<floor(id/500)>/<id>.mp3 (or <id>_<part>.mp3). Free. */
export function githubReleases(audioBase: string): AudioStore {
  return {
    name: "github-releases",
    audioUrl: (id, part, lesson) => `${audioBase}/audio-${Math.floor(id / 500)}/${fileName(id, part, lesson.p)}`,
    videoUrl: (id) => `${audioBase}/audio-${Math.floor(id / 500)}/${id}.mp4`,
  };
}

/**
 * Any S3-compatible bucket with a public URL: Cloudflare R2 (no download fees), Backblaze B2, AWS S3, MinIO …
 * Files are stored flat: <publicBase>/<id>.mp3
 */
export function s3Audio(publicBase: string): AudioStore {
  const base = publicBase.replace(/\/$/, "");
  return { name: "s3", audioUrl: (id, part, lesson) => `${base}/${fileName(id, part, lesson.p)}`, videoUrl: (id) => `${base}/${id}.mp4` };
}
