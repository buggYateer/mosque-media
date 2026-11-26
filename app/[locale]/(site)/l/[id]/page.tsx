import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Crumbs } from "@/components/blocks";
import { Cover } from "@/components/cover";
import { LessonActions } from "@/components/lesson-actions";
import { Link } from "@/i18n/navigation";
import { getLookup, getSite } from "@/lib/data";
import { dateText } from "@/lib/dates";
import { parseVideo } from "@/lib/media";
import { audioStore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/video-player";

// Every page here is prerendered (generateStaticParams), so navigating to it is already instant;
// this only turns off the dev-time «URL data» note about reading params outside <Suspense>.
export const instant = false;

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
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const video = parseVideo(item.vid, audioStore.videoUrl(item.id));
  const cover = (
    <Cover
      pat={item.id}
      tone={item.sh?.tone}
      kind={item.k}
      tag={item.se?.sec || item.se?.title || t(`kind.${item.k}`)}
      title={item.t}
      byline={item.sh ? `${t("common.sheikh")} ${item.sh.name}` : undefined}
      className="rounded-xl"
    />
  );
  const date = dateText(item, { months: t.raw("common.months") as string[], hijriSuffix: t("common.hijriSuffix"), locale });
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <Crumbs
        items={[
          ...(item.sh ? [{ href: `/s/${item.sh.slug}`, label: item.sh.name }] : []),
          ...(item.sh && item.se ? [{ href: `/s/${item.sh.slug}/${item.se.key}`, label: item.se.title }] : []),
        ]}
      />
      {/* a video gets the wide column; a cover sits next to the details */}
      <article className={cn("mm-lesson-page mt-2 grid items-start gap-6", video ? "lg:grid-cols-[minmax(0,1fr)_360px]" : "md:grid-cols-[minmax(0,420px)_1fr]")}>
        {video ? <VideoPlayer v={video} id={item.id} title={item.t} poster={cover} /> : cover}
        <div>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">{t(`kind.${item.k}`)}</span>
          <h1 className="my-2 text-3xl leading-snug font-extrabold">
            {item.n ? <span className="text-primary">{item.n} </span> : null}
            {item.t}
          </h1>
          <p className="text-muted-foreground">
            {item.sh ? (
              <Link href={`/s/${item.sh.slug}`} className="font-semibold text-primary hover:underline">
                {t("common.sheikh")} <bdi>{item.sh.name}</bdi>
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
          <p className="text-muted-foreground">{[date, item.d].filter(Boolean).join(" · ")}</p>
          <LessonActions item={item} />
        </div>
      </article>
    </main>
  );
}
