/**
 * Contract test every data store must pass: pnpm test:storage
 * Runs the SQL store against an in-memory PostgreSQL (PGlite) and a temporary SQLite file,
 * and checks the JSON-file store reads the bundled data. Add new providers here.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@libsql/client";
import { githubJson } from "@/lib/storage/github-json";
import { sqlStore, type SqlRunner } from "@/lib/storage/sql-store";
import { librarySchema, type Overrides } from "@/lib/storage/types";
import { applyOverrides } from "@/lib/overrides";

const library = librarySchema.parse(JSON.parse(readFileSync(join(process.cwd(), "content", "lessons.json"), "utf8")));
const firstId = Object.keys(library.lessons)[0];
const edits: Overrides = {
  edit: { [firstId]: { t: "Edited title ✓ عنوان معدّل" } },
  add: { "99999": { t: "New", s: library.sheikhs[0].key, k: "lesson", d: "1:00", h: "", p: 1 } },
  featured: [Number(firstId)],
  ignore: [12345],
  series: [],
  seriesEdit: {},
};

async function contract(name: string, store: ReturnType<typeof sqlStore>) {
  await store.saveLibrary(library);
  assert.deepEqual(await store.getLibrary(), library, `${name}: library round-trip`);
  assert.deepEqual((await store.getOverrides()).edit, {}, `${name}: empty overrides by default`);
  await store.saveOverrides(edits, "test 1");
  await store.saveOverrides(edits, "test 2");
  const back = await store.getOverrides({ fresh: true });
  assert.deepEqual(back, { ...edits, add: { "99999": { ...edits.add["99999"] } } }, `${name}: overrides round-trip`);
  assert.equal(await store.history("overrides"), 2, `${name}: history keeps every save`);
  const site = applyOverrides(await store.getLibrary(), back);
  assert.equal(site.lessons[firstId].t, "Edited title ✓ عنوان معدّل", `${name}: edits apply`);
  assert.ok(site.lessons["99999"], `${name}: added clip appears`);
  console.log(`✓ ${name}`);
}

async function main() {
  // JSON files (default)
  const lib = await githubJson.getLibrary();
  assert.ok(Object.keys(lib.lessons).length > 0, "github-json: bundled library");
  await githubJson.getOverrides();
  console.log("✓ github-json (read)");

  // PostgreSQL (in-memory PGlite stands in for Supabase/Neon/Postgres)
  const pg = new PGlite();
  const pgRunner: SqlRunner = { dialect: "postgres", exec: async (q, p = []) => (await pg.query(q, p)).rows as Record<string, unknown>[] };
  await contract("postgres", sqlStore("postgres", pgRunner));
  await pg.close();

  // SQLite (local file; Turso uses the same client over the network)
  const dir = mkdtempSync(join(tmpdir(), "mm-sqlite-"));
  const client = createClient({ url: `file:${join(dir, "test.db")}` });
  const liteRunner: SqlRunner = { dialect: "sqlite", exec: async (q, p = []) => (await client.execute({ sql: q, args: p as never[] })).rows as unknown as Record<string, unknown>[] };
  await contract("sqlite", sqlStore("sqlite", liteRunner));
  client.close();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* Windows may keep the file locked briefly; it's in the temp folder anyway */
  }
}

main().then(
  () => console.log("All storage tests passed."),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
