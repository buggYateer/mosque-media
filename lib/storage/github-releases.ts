/**
 * Default audio provider: GitHub Releases.
 * File layout (uploaded by tools/update_site.py): audio-<floor(id/500)>/<id>.mp3, or <id>_<part>.mp3 for multi-part clips.
 */
import type { AudioStore } from "./types";

export function githubReleases(audioBase: string): AudioStore {
  return {
    name: "github-releases",
    audioUrl(id, part, lesson) {
      const file = lesson.p > 1 ? `${id}_${part}.mp3` : `${id}.mp3`;
      return `${audioBase}/audio-${Math.floor(id / 500)}/${file}`;
    },
  };
}
