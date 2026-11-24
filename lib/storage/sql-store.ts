/**
 * Database data store (PostgreSQL — incl. Supabase, Neon, Vercel Postgres — or SQLite/Turso).
 *
 * Deliberately simple: one table of JSON documents ("library", "overrides") plus a history
 * table, so every save can be undone like a git commit. The same JSON shapes as the files
 * in content/, so moving between providers is a copy (pnpm data:sync / data:export).
 */
import { librarySchema, overridesSchema, type DataStore, type Library, type Overrides } from "./types";

export type SqlRunner = {
  dialect: "postgres" | "sqlite";
  /** Run one statement; `?` placeholders are rewritten to $1, $2 … for Postgres. */
  exec(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
};

const DOCS = "mosque_documents";
const HISTORY = "mosque_document_history";

export function sqlStore(name: string, run: SqlRunner): DataStore & { saveLibrary(lib: Library): Promise<void>; history(key: string): Promise<number> } {
  let ready: Promise<void> | null = null;
  const q = (sql: string, params: unknown[] = []) => {
    let n = 0;
    return run.exec(run.dialect === "postgres" ? sql.replace(/\?/g, () => `$${++n}`) : sql, params);
  };
  const init = () =>
    (ready ??= (async () => {
      await q(`CREATE TABLE IF NOT EXISTS ${DOCS} (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      await q(
        `CREATE TABLE IF NOT EXISTS ${HISTORY} (id ${run.dialect === "postgres" ? "BIGSERIAL" : "INTEGER"} PRIMARY KEY ${run.dialect === "sqlite" ? "AUTOINCREMENT" : ""}, key TEXT NOT NULL, value TEXT NOT NULL, message TEXT, saved_at TEXT NOT NULL)`,
      );
    })());

  async function read(key: string) {
    await init();
    const rows = await q(`SELECT value FROM ${DOCS} WHERE key = ?`, [key]);
    return rows[0] ? JSON.parse(String(rows[0].value)) : null;
  }
  async function write(key: string, value: unknown, message: string) {
    await init();
    const json = JSON.stringify(value);
    const now = new Date().toISOString();
    await q(`INSERT INTO ${DOCS} (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, [key, json, now]);
    await q(`INSERT INTO ${HISTORY} (key, value, message, saved_at) VALUES (?, ?, ?, ?)`, [key, json, message, now]);
  }

  return {
    name,
    async getLibrary() {
      const v = await read("library");
      if (!v) throw new Error(`The ${name} database has no library yet. Run: pnpm data:sync`);
      return librarySchema.parse(v);
    },
    async getOverrides() {
      return overridesSchema.parse((await read("overrides")) ?? {});
    },
    async saveOverrides(overrides: Overrides, message: string) {
      await write("overrides", overridesSchema.parse(overrides), message);
    },
    async saveLibrary(lib: Library) {
      await write("library", librarySchema.parse(lib), "data:sync");
    },
    async history(key: string) {
      await init();
      const rows = await q(`SELECT COUNT(*) AS n FROM ${HISTORY} WHERE key = ?`, [key]);
      return Number(rows[0]?.n ?? 0);
    },
  };
}
