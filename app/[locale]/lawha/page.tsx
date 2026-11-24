import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Dashboard } from "@/components/lawha/dashboard";
import { Logo } from "@/components/logo";
import { Toaster } from "@/components/ui/sonner";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lawha");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** The dashboard page is a static shell; everything else loads from /api/admin/* after signing in. */
export default async function LawhaPage() {
  const m = await getMessages();
  return (
    <NextIntlClientProvider messages={{ lawha: m.lawha, kind: m.kind, kinds: m.kinds, nav: m.nav, common: m.common }}>
      <Dashboard logo={<Logo className="size-8" />} />
      <Toaster position="bottom-center" />
    </NextIntlClientProvider>
  );
}
