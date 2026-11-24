/**
 * Picks the storage providers chosen in site.config.json → storage.
 * Database clients are imported lazily, so a site that keeps the default JSON files
 * never loads them.
 */
import { config } from "@/lib/config";
import { githubJson } from "./github-json";
import { githubReleases, s3Audio } from "./audio";
import type { AudioStore, DataStore } from "./types";

let store: Promise<DataStore> | null = null;

export function getDataStore(): Promise<DataStore> {
  return (store ??= (async () => {
    switch (config.storage.data.provider) {
      case "postgres": {
        const [{ sqlStore }, { postgresRunner }] = await Promise.all([import("./sql-store"), import("./runners")]);
        return sqlStore("postgres", await postgresRunner());
      }
      case "sqlite": {
        const [{ sqlStore }, { sqliteRunner }] = await Promise.all([import("./sql-store"), import("./runners")]);
        return sqlStore("sqlite", await sqliteRunner());
      }
      default:
        return githubJson;
    }
  })());
}

export const dataProviderName = config.storage.data.provider;

const a = config.storage.audio;
export const audioStore: AudioStore = a.provider === "s3" ? s3Audio(a.publicBase) : githubReleases(config.audioBase);

export type * from "./types";
