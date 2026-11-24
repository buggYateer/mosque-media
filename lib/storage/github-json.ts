/**
 * Default data provider: JSON files in the repository (content/).
 * - content/lessons.json   ← written by tools/build_data.py
 * - content/overrides.json ← written by the /lawha dashboard (through the GitHub API, phase 3)
 * Free, no extra account, and every change is a git commit you can undo.
 */
import lessonsJson from "@/content/lessons.json";
import overridesJson from "@/content/overrides.json";
import { commitFiles, readRepoFile } from "@/lib/admin/github";
import { librarySchema, overridesSchema, type DataStore, type Library, type Overrides } from "./types";

const FILE = "content/overrides.json";

function parseOrExplain<T>(what: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    const first = r.error.issues.slice(0, 5).map((i) => `  • ${what} → ${i.path.join(".")}: ${i.message}`);
    throw new Error(`${what} is not valid:\n${first.join("\n")}\nRe-run: python tools/build_data.py`);
  }
  return r.data;
}

export const githubJson: DataStore = {
  name: "github-json",
  async getLibrary(): Promise<Library> {
    return parseOrExplain("content/lessons.json", librarySchema, lessonsJson);
  },
  async getOverrides(opts): Promise<Overrides> {
    if (opts?.fresh) {
      try {
        const latest = await readRepoFile(FILE);
        if (latest !== null) return parseOrExplain(FILE, overridesSchema, JSON.parse(latest));
      } catch (e) {
        // Local previews may have no real GitHub access; production must never fall back to an old copy.
        if (process.env.NODE_ENV !== "development") throw e;
      }
    }
    return parseOrExplain(FILE, overridesSchema, overridesJson);
  },
  async saveOverrides(overrides, message, extraFiles = []) {
    await commitFiles([{ path: FILE, content: JSON.stringify(overrides, null, 1) + "\n" }, ...extraFiles], message);
  },
};
