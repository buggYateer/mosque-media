/**
 * Copy data between the JSON files in content/ and the database chosen in site.config.json.
 *
 *   pnpm data:sync     content/lessons.json + content/overrides.json  →  database
 *   pnpm data:export   database  →  content/*.json   (to move back to files, or to another provider)
 *
 * tools/update_site.py runs `data:sync` automatically when the data provider is a database.
 * Needs DATABASE_URL (and DATABASE_AUTH_TOKEN for Turso) in the environment or .env.local.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "@/lib/config";
import { getDataStore } from "@/lib/storage";
import { librarySchema, overridesSchema } from "@/lib/storage/types";

const root = process.cwd();
// Load .env.local for local runs (Vercel provides real environment variables).
const envFile = join(root, ".env.local");
if (existsSync(envFile))
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }

async function main() {
  const provider = config.storage.data.provider;
  if (provider === "github-json") {
    console.log("Data provider is github-json (files in content/) — nothing to sync.");
    return;
  }
  const store = (await getDataStore()) as Awaited<ReturnType<typeof getDataStore>> & { saveLibrary?: (l: unknown) => Promise<void> };
  const lessonsPath = join(root, "content", "lessons.json");
  const overridesPath = join(root, "content", "overrides.json");

  if (process.argv.includes("--export")) {
    writeFileSync(lessonsPath, JSON.stringify(await store.getLibrary()));
    writeFileSync(overridesPath, JSON.stringify(await store.getOverrides(), null, 1) + "\n");
    console.log(`✓ Exported ${provider} → content/lessons.json, content/overrides.json`);
    return;
  }
  const library = librarySchema.parse(JSON.parse(readFileSync(lessonsPath, "utf8")));
  await store.saveLibrary!(library);
  // Overrides: keep the database's (the dashboard writes there) unless it has none yet.
  const current = await store.getOverrides();
  const empty = !Object.keys(current.edit).length && !Object.keys(current.add).length && !current.featured.length;
  if (empty && existsSync(overridesPath)) await store.saveOverrides(overridesSchema.parse(JSON.parse(readFileSync(overridesPath, "utf8"))), "data:sync (initial)");
  console.log(`✓ Synced ${Object.keys(library.lessons).length} recordings → ${provider}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(1);
  },
);
