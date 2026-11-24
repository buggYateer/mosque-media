/**
 * Database connections for sql-store. The connection string lives ONLY in environment
 * variables (Vercel → Settings → Environment Variables), never in files:
 *   DATABASE_URL         postgres://…  (Postgres / Supabase / Neon)   or  libsql://… / file:… (SQLite / Turso)
 *   DATABASE_AUTH_TOKEN  Turso only
 */
import type { SqlRunner } from "./sql-store";

function url() {
  const u = process.env.DATABASE_URL;
  if (!u) throw new Error("DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables (and .env.local for local work).");
  return u;
}

export async function postgresRunner(): Promise<SqlRunner> {
  const { default: postgres } = await import("postgres");
  // prepare:false works with Supabase/Neon connection poolers (transaction mode).
  const sql = postgres(url(), { prepare: false, max: 3, idle_timeout: 20 });
  return { dialect: "postgres", exec: async (q, params = []) => [...(await sql.unsafe(q, params as never[]))] as Record<string, unknown>[] };
}

export async function sqliteRunner(): Promise<SqlRunner> {
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url: url(), authToken: process.env.DATABASE_AUTH_TOKEN });
  return { dialect: "sqlite", exec: async (q, params = []) => (await client.execute({ sql: q, args: params as never[] })).rows as unknown as Record<string, unknown>[] };
}
