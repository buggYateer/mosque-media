/** Small server components shared by the pages. */
import { User } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { config } from "@/lib/config";
import { clipCount, seriesIds } from "@/lib/library";
import type { Series, SheikhData } from "@/lib/storage/types";
import { toneOf } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Cover } from "./cover";
import { ShareButton } from "./share-button";

export const cleanTitle = (t: string) => t.replace(/^سلسلة\s+/, "").replace(/\s*\(.*?\)\s*/g, " ").trim();

export async function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  const t = await getTranslations("common");
  return (
    <nav aria-label="breadcrumb" className="mb-2 text-sm text-muted-foreground">
      <Link href="/" className="hover:text-primary">
        {t("home")}
      </Link>
      {items.map((x) => (
        <span key={x.label}>
          {" ‹ "}
          {x.href ? (
            <Link href={x.href} className="hover:text-primary">
              {x.label}
            </Link>
          ) : (
            x.label
          )}
        </span>
      ))}
    </nav>
  );
}

export async function PageHead({ title, sub, share, actions, crumbs = true }: { title: string; sub?: string; share?: string; actions?: ReactNode; crumbs?: boolean }) {
  return (
    <>
      {crumbs ? <Crumbs items={[{ label: title }]} /> : null}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 pt-2 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          {sub ? <p className="mt-0.5 text-muted-foreground">{sub}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {share ? <ShareButton path={share} title={title} /> : null}
        </div>
      </header>
    </>
  );
}

export async function SectionHead({ title, href, id }: { title: string; href?: string; id?: string }) {
  const t = await getTranslations("common");
  return (
    <div id={id} className="mt-9 mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[21px] font-extrabold">{title}</h2>
      {href ? (
        <Link href={href} className="text-[14.5px] font-bold text-primary hover:underline">
          {t("seeAll")}
        </Link>
      ) : null}
    </div>
  );
}

export async function SheikhCards({ list, className }: { list: SheikhData[]; className?: string }) {
  const t = await getTranslations("common");
  return (
    <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3", className)}>
      {list.map((s) => {
        const day = config.sheikhs.find((x) => x.key === s.key)?.day;
        return (
          <Link
            key={s.key}
            href={`/s/${s.slug}`}
            className="flex flex-col gap-1.5 rounded-xl border border-t-[5px] bg-card p-4 transition-shadow hover:shadow-md"
            style={{ borderTopColor: `var(--tone-${toneOf(config, s.key)}, var(--primary))` }}
          >
            <small className="text-[13px] text-muted-foreground">{t("sheikh")}</small>
            <span className="text-[19px] font-extrabold">{s.name}</span>
            {day ? <span className="self-start rounded-full bg-accent px-2.5 text-[13px] font-bold text-accent-foreground">{day}</span> : null}
          </Link>
        );
      })}
    </div>
  );
}

export async function SeriesCard({ se, sh }: { se: Series; sh: SheikhData }) {
  const t = await getTranslations();
  return (
    <Link href={`/s/${sh.slug}/${se.key}`} className="flex flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary">
      <Cover
        tone={toneOf(config, sh.key)}
        kind="series"
        tag={/^سلسلة/.test(se.title) ? t("sheikh.seriesLabel") : t("sheikh.lessonsLabel")}
        title={cleanTitle(se.title)}
        byline={`${t("common.sheikh")} ${sh.name}`}
      />
      <div className="px-3.5 pt-2.5 pb-3">
        <h3 className="line-clamp-2 text-[15.5px] font-bold">{se.title}</h3>
        <p className="mt-0.5 text-[13.5px] text-muted-foreground">
          {t("common.sheikh")} {sh.name} · {t("common.lessonsCount", { count: seriesIds(se).length })}
        </p>
      </div>
    </Link>
  );
}

export async function OthersGrid({ list }: { list: SheikhData[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
      {list.map((s) => (
        <Link key={s.key} href={`/s/${s.slug}`} className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 hover:border-primary">
          <User className="size-5 text-muted-foreground" />
          <span className="flex-1 font-semibold">{s.name}</span>
          <b className="text-sm text-muted-foreground tabular-nums">{clipCount(s)}</b>
        </Link>
      ))}
    </div>
  );
}

export function Rail({ children }: { children: ReactNode }) {
  return <div className="grid auto-cols-[minmax(220px,260px)] grid-flow-col gap-3 overflow-x-auto pb-1.5 [scroll-snap-type:x_mandatory] *:[scroll-snap-align:start]">{children}</div>;
}
