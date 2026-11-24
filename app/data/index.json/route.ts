import { getLookup } from "@/lib/data";

/**
 * Compact index of every recording, loaded by the search page only when someone searches.
 * Prerendered at build time (it only reads cached data).
 */
export async function GET() {
  const lk = await getLookup();
  const KW: Record<string, string> = { lesson: "درس دروس lesson", khutba: "خطبة خطب الجمعة sermon khutbah", tilawa: "تلاوة تلاوات recitation", other: "" };
  const items = lk.items(lk.ids).map((i) => ({ ...i, x: [KW[i.k], i.se?.title, i.se?.sec].filter(Boolean).join(" ") }));
  return Response.json(items, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
