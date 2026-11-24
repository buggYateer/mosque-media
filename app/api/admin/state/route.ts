import { adminConfigured, isAdmin } from "@/lib/admin/session";
import { config } from "@/lib/config";
import { getDataStore } from "@/lib/storage";

/** Everything the dashboard needs: the library from the channel, the latest dashboard edits, the sheikhs and series. */
export async function GET() {
  if (!adminConfigured()) return Response.json({ error: "not-configured" }, { status: 503 });
  if (!(await isAdmin())) return Response.json({ error: "signed-out" }, { status: 401 });
  try {
    const store = await getDataStore();
    const [library, overrides] = await Promise.all([store.getLibrary(), store.getOverrides({ fresh: true })]);
    const seriesOf: Record<string, string> = {};
    for (const sh of library.sheikhs)
      for (const se of sh.series ?? []) for (const sec of se.sections) for (const id of sec.ids) seriesOf[id] = `${se.key}|${se.sections.length > 1 ? sec.t : ""}`;
    return Response.json({
      channel: config.telegramChannel,
      storage: { data: store.name, audio: config.storage.audio.provider },
      uploads: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      lessons: library.lessons,
      sheikhs: library.sheikhs.map((s) => ({ key: s.key, name: s.name, series: (s.series ?? []).map((se) => ({ key: se.key, title: se.title, sections: se.sections.map((x) => x.t) })) })),
      seriesOf,
      overrides,
    });
  } catch (e) {
    return Response.json({ error: "load-failed", detail: String(e) }, { status: 502 });
  }
}
