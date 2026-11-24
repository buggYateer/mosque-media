"use client";

import { ArrowUpDown, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useStored } from "@/lib/use-stored";
import { MiniMenu } from "./mini-menu";

type Mode = "count" | "az" | "za";
type Row = { slug: string; name: string; n: number };

/** Speakers list with a sort choice remembered on this device (like the original site). */
export function OthersSorted({ list }: { list: Row[] }) {
  const t = useTranslations("filters");
  const locale = useLocale();
  const [stored, setStored] = useStored("osort", "count");
  const mode: Mode = stored === "az" || stored === "za" ? stored : "count";
  const by: Record<Mode, (a: Row, b: Row) => number> = {
    count: (a, b) => b.n - a.n,
    az: (a, b) => a.name.localeCompare(b.name, locale),
    za: (a, b) => b.name.localeCompare(a.name, locale),
  };
  const sorted = [...list].sort(by[mode]);
  return (
    <>
      <div className="-mt-2 mb-3 flex justify-end">
        <MiniMenu
          label={t("sort")}
          align="end"
          triggerClass="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-3.5 text-sm font-semibold hover:bg-muted"
          trigger={
            <>
              <ArrowUpDown className="size-4.5 text-primary" />
              {t("sort")}
            </>
          }
          items={(["count", "az", "za"] as const).map((m) => ({
            key: m,
            checked: mode === m,
            label: t(m === "count" ? "sortCount" : m === "az" ? "sortAz" : "sortZa"),
            onSelect: () => setStored(m),
          }))}
        />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
        {sorted.map((s) => (
          <Link key={s.slug} href={`/s/${s.slug}`} className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 hover:border-primary">
            <User className="size-5 text-muted-foreground" />
            <span className="flex-1 font-semibold">{s.name}</span>
            <b className="text-sm text-muted-foreground tabular-nums">{s.n}</b>
          </Link>
        ))}
      </div>
    </>
  );
}
