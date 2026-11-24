"use client";

import { ArrowUpDown, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useStored } from "@/lib/use-stored";
import { Link } from "@/i18n/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

type Mode = "count" | "az" | "za";

/** Speakers list with a sort choice remembered on this device (like the original site). */
export function OthersSorted({ list }: { list: { slug: string; name: string; n: number }[] }) {
  const t = useTranslations("filters");
  const locale = useLocale();
  const [stored, setStored] = useStored("osort", "count");
  const mode: Mode = stored === "az" || stored === "za" ? stored : "count";
  const by = { count: (a: (typeof list)[0], b: (typeof list)[0]) => b.n - a.n, az: (a: (typeof list)[0], b: (typeof list)[0]) => a.name.localeCompare(b.name, locale), za: (a: (typeof list)[0], b: (typeof list)[0]) => b.name.localeCompare(a.name, locale) };
  const sorted = [...list].sort(by[mode]);
  return (
    <>
      <div className="-mt-2 mb-3 flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-3.5 text-sm font-semibold hover:bg-muted">
            <ArrowUpDown className="size-4.5 text-primary" />
            {t("sort")}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-48">
            <DropdownMenuRadioGroup
              value={mode}
              onValueChange={(v) => setStored(String(v))}
            >
              <DropdownMenuRadioItem value="count">{t("sortCount")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="az">{t("sortAz")}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="za">{t("sortZa")}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
