import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";

/** First letter of the mosque name (without «مسجد» and «ال»), used until a real logo is added. */
export function initialOf(name: string) {
  const word = name.trim().replace(/^(مسجد|جامع|مصلى)\s+/, "").split(/\s+/)[0] ?? name;
  return (word.replace(/^ال(?=..)/, "")[0] ?? "م").toUpperCase();
}

const logoFile = ["svg", "png"].find((ext) => existsSync(join(process.cwd(), "public", "brand", `logo.${ext}`)));

/** The mosque logo from assets/ (copied to public/brand/ by scripts/prepare.mjs), or a letter placeholder. */
export function Logo({ className }: { className?: string }) {
  if (logoFile) {
    // eslint-disable-next-line @next/next/no-img-element -- tiny local logo, no optimization needed
    return <img src={`/brand/logo.${logoFile}`} alt="" className={cn("size-9 rounded-md object-contain", className)} />;
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 place-items-center rounded-md bg-primary text-lg font-extrabold text-primary-foreground ring-2 ring-header-foreground/15",
        className,
      )}
    >
      {initialOf(config.name)}
    </span>
  );
}
