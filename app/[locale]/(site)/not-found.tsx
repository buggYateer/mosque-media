import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="mx-auto max-w-6xl px-4 py-16 text-center text-muted-foreground">
      <p className="text-lg">{t("notFound")}</p>
      <Link href="/" className="mt-3 inline-block font-bold text-primary underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
