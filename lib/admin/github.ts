/**
 * Minimal GitHub API client used by the dashboard (server side only).
 * Several files are saved in ONE commit (git data API), so Vercel deploys once per "publish".
 */
import { config } from "@/lib/config";

const API = "https://api.github.com";

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}/repos/${config.githubRepo}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as T & { message?: string };
  if (!r.ok) throw new Error(j.message || `GitHub ${r.status}`);
  return j;
}

/** Current content of a text file on the default branch (null if it doesn't exist). */
export async function readRepoFile(path: string, branch = "main"): Promise<string | null> {
  try {
    const f = await gh<{ content: string }>(`contents/${encodeURI(path)}?ref=${branch}`);
    return Buffer.from(f.content, "base64").toString("utf8");
  } catch (e) {
    if (/Not Found/i.test(String(e))) return null;
    throw e;
  }
}

/** File names in a folder of the repository (empty if it doesn't exist). */
export async function listRepoDir(path: string, branch = "main"): Promise<string[]> {
  try {
    const items = await gh<{ name: string; type: string }[]>(`contents/${encodeURI(path)}?ref=${branch}`);
    return Array.isArray(items) ? items.filter((x) => x.type === "file").map((x) => x.name) : [];
  } catch (e) {
    if (/Not Found/i.test(String(e))) return [];
    throw e;
  }
}

/** Commit several text files at once on top of the latest commit of `branch`. */
export async function commitFiles(files: { path: string; content: string }[], message: string, branch = "main") {
  const ref = await gh<{ object: { sha: string } }>(`git/ref/heads/${branch}`);
  const head = await gh<{ tree: { sha: string } }>(`git/commits/${ref.object.sha}`);
  const tree = await gh<{ sha: string }>("git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: head.tree.sha, tree: files.map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content })) }),
  });
  const commit = await gh<{ sha: string }>("git/commits", { method: "POST", body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }) });
  await gh(`git/refs/heads/${branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
  return commit.sha;
}
