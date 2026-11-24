import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { SiteHeader } from "@/components/site-header";
import { config } from "@/lib/config";
import { getSite } from "@/lib/data";

/** Public pages: header + the persistent audio player. */
export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const site = await getSite();
  // Demo data has no real audio: a small route plays a tone instead (also used for local previews of data/audio).
  const audioBase = site.demo || process.env.NODE_ENV === "development" ? "/api/dev-audio" : config.audioBase;
  return (
    <PlayerProvider audioBase={audioBase} channel={config.telegramChannel} siteName={config.name} logo="/icons/icon-512.png">
      <div className="pb-8 [.has-player_&]:pb-48 md:[.has-player_&]:pb-32">
        <SiteHeader />
        {children}
      </div>
      <PlayerBar />
    </PlayerProvider>
  );
}
