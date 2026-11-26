import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { config } from "@/lib/config";
import { textIn, TYPES } from "@/lib/site-shared";
import { routing } from "./routing";

type Tree = { [k: string]: string | string[] | Tree };

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

/**
 * The site's wording = messages/<language>.json, then each content type's name from site.config.json,
 * then any wording the mosque changed (`texts`).
 */
export function withCustomTexts(messages: Tree, locale: string): Tree {
  const m = structuredClone(messages);
  for (const t of TYPES) {
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
  for (const [k, v] of Object.entries(config.texts[locale as keyof typeof config.texts] ?? {})) put(m, k, v);
  return m;
}

export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootLocale());
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale: resolved,
    messages: withCustomTexts((await import(`../messages/${resolved}.json`)).default, resolved),
  };
});
