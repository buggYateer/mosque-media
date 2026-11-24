import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/blocks";
import { Cover } from "@/components/cover";
import { LessonActions } from "@/components/lesson-actions";
import { Link } from "@/i18n/navigation";
import { getLookup, getSite } from "@/lib/data";
import { formatHijri } from "@/lib/text";

export async function generateStaticParams() {
  return Object.keys((await getSite()).lessons).map((id) => ({ id }));
}

async function find(params: Promise<{ id: string }>) {
  const { id } = await params;
  const lk = await getLookup();
  if (!/^\d+$/.test(id) || !lk.site.lessons[id]) notFound();
  return { lk, item: lk.item(Number(id)) };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/l/[id]">): Promise<Metadata> {
  const { item } = await find(params);
  const t = await getTranslations("common");
  const by = item.sh ? `${t("sheikh")} ${item.sh.name}` : "";
  return { title: item.t, description: [by, item.se?.title].filter(Boolean).join(" — ") || undefined, openGraph: { title: item.t, description: by || undefined, type: "music.song" } };
}

/** One page per recording: shareable link with its own title and preview. */
export default async function LessonPage({ params }: PageProps<"/[locale]/l/[id]">) {
  const { item } = await find(params);
  const t = await getTranslations();
  const hijri = formatHijri(item.h, t.raw("common.months") as string[], t("common.hijriSuffix"));
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <Crumbs
        items={[
          ...(item.sh ? [{ href: `/s/${item.sh.slug}`, label: item.sh.name }] : []),
          ...(item.sh && item.se ? [{ href: `/s/${item.sh.slug}/${item.se.key}`, label: item.se.title }] : []),
        ]}
      />
      <article className="mt-2 grid items-start gap-6 md:grid-cols-[minmax(0,420px)_1fr]">
        <Cover
          tone={item.sh?.tone}
          kind={item.k}
          tag={item.se?.sec || item.se?.title || t(`kind.${item.k}`)}
          title={item.t}
          byline={item.sh ? `${t("common.sheikh")} ${item.sh.name}` : undefined}
          className="rounded-xl"
        />
        <div>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">{t(`kind.${item.k}`)}</span>
          <h1 className="my-2 text-3xl leading-snug font-extrabold">
            {item.n ? <span className="text-primary">{item.n} </span> : null}
            {item.t}
          </h1>
          <p className="text-muted-foreground">
            {item.sh ? (
              <Link href={`/s/${item.sh.slug}`} className="font-semibold text-primary hover:underline">
                {t("common.sheikh")} {item.sh.name}
              </Link>
            ) : null}
            {item.sh && item.se ? (
              <>
                {" · "}
                <Link href={`/s/${item.sh.slug}/${item.se.key}`} className="font-semibold text-primary hover:underline">
                  {item.se.title}
                </Link>
              </>
            ) : null}
          </p>
          <p className="text-muted-foreground">{[hijri, item.d].filter(Boolean).join(" · ")}</p>
          <LessonActions item={item} />
        </div>
      </article>
    </main>
  );
}
