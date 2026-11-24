import { shareImage } from "@/lib/brand-image";

/** The image shown when the site is shared (WhatsApp, Telegram, Facebook …). */
export function GET() {
  return shareImage();
}
