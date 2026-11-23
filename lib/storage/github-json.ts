/**
 * Default data provider: JSON files in the repository (content/).
 * - content/lessons.json   ← written by tools/build_data.py
 * - content/overrides.json ← written by the /lawha dashboard (through the GitHub API, phase 3)
 * Free, no extra account, and every change is a git commit you can undo.
 */
import lessonsJson from "@/content/lessons.json";
import overridesJson from "@/content/overrides.json";
import { librarySchema, overridesSchema, type DataStore, type Library, type Overrides } from "./types";

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
  async getOverrides(): Promise<Overrides> {
    return parseOrExplain("content/overrides.json", overridesSchema, overridesJson);
  },
};
