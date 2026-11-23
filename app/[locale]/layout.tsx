import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { locale as rootLocale } from "next/root-params";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { routing } from "@/i18n/routing";
import { config, RTL_LOCALES, type Locale } from "@/lib/config";
import { siteFont } from "@/lib/generated/font";
import { themeCss } from "@/lib/theme";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: { default: config.name, template: `%s — ${config.name}` },
  description: config.description,
  applicationName: config.shortName,
  ...(config.domain ? { metadataBase: new URL(config.domain) } : {}),
  openGraph: { siteName: config.name, type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: config.design.header === "colored" ? config.colors.primary : "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1c1e" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();
  const dir = RTL_LOCALES.includes(locale as Locale) ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir} className={siteFont.variable} suppressHydrationWarning>
      <head>
        <style>{themeCss(config)}</style>
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          <NextIntlClientProvider>
            <SiteHeader />
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
