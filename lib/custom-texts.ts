/**
 * The site's wording = messages/<language>.json, then each content type's name from site.config.json,
 * then any wording the mosque changed (`texts`). Used by i18n/request.ts.
 */
import { config } from "@/lib/config";
import { type SiteType, textIn, TYPES } from "@/lib/site-shared";

export type Tree = { [k: string]: string | string[] | Tree };

/** Sets "a.b.c" inside a nested messages object. */
function put(tree: Tree, path: string, value: string) {
  const keys = path.split(".");
  let node = tree;
  for (const k of keys.slice(0, -1)) {
    if (typeof node[k] !== "object" || Array.isArray(node[k])) node[k] = {};
    node = node[k] as Tree;
  }
  node[keys.at(-1)!] = value;
}

/** Each built-in type's section has its own menu key and page. */
const PAGE_OF: Record<string, string> = { lesson: "lessons", khutba: "khutab", tilawa: "tilawat" };

/** `types` and `texts` default to the site's own (given explicitly in tests). */
export function withCustomTexts(messages: Tree, locale: string, types: SiteType[] = TYPES, texts: Partial<Record<string, Record<string, string>>> = config.texts): Tree {
  const m = structuredClone(messages);
  for (const t of types) {
    const name = textIn(t.name, locale);
    const plural = textIn(t.plural, locale);
    if (name) put(m, `kind.${t.key}`, name);
    if (plural) {
      put(m, `kinds.${t.key}`, plural);
      const page = PAGE_OF[t.key];
      if (page) {
        put(m, `nav.${page}`, plural);
        put(m, `pages.${page}.title`, plural);
        // «3 lessons» no longer fits a renamed type: use the general «3 recordings»
        put(m, `pages.${page}.unit`, ((m.pages as Tree).all as Tree).unit as string);
      }
    }
  }
  for (const [k, v] of Object.entries(texts[locale] ?? {})) put(m, k, v);
  return m;
}
