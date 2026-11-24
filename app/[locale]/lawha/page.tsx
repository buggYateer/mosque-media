import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Dashboard } from "@/components/lawha/dashboard";
import { Logo } from "@/components/logo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lawha");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The dashboard page is a static shell; everything else loads from /api/admin/* after signing in. */
export default function LawhaPage() {
  return <Dashboard logo={<Logo className="size-8" />} />;
}
