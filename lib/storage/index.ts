import { config } from "@/lib/config";
import { githubJson } from "./github-json";
import { githubReleases } from "./github-releases";
import type { AudioStore, DataStore } from "./types";

const dataProviders: Record<string, () => DataStore> = {
  "github-json": () => githubJson,
};

const audioProviders: Record<string, () => AudioStore> = {
  "github-releases": () => githubReleases(config.audioBase),
};

export const dataStore: DataStore = dataProviders[config.storage.data.provider]();
export const audioStore: AudioStore = audioProviders[config.storage.audio.provider]();

export type * from "./types";
