import {
  AudioLines,
  Baby,
  BookMarked,
  BookOpen,
  BookText,
  CalendarDays,
  Clock,
  GraduationCap,
  HandHeart,
  Heart,
  Home,
  Landmark,
  Library,
  Lightbulb,
  MessagesSquare,
  Mic,
  Moon,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  TrendingUp,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { typeOf } from "@/lib/site-shared";

/**
 * Icon names used in site.config.json (types, collections) and in the menu → icons.
 * Any of these names can be used as a type's or a collection's "icon".
 */
export const ICONS: Record<string, LucideIcon> = {
  // content types
  tilawa: AudioLines,
  lesson: BookText,
  khutba: Mic,
  other: BookOpen,
  book: BookText,
  "book-open": BookOpen,
  quran: BookMarked,
  mic: Mic,
  audio: AudioLines,
  video: Video,
  school: GraduationCap,
  child: Baby,
  users: Users,
  talk: MessagesSquare,
  heart: Heart,
  charity: HandHeart,
  star: Star,
  sparkles: Sparkles,
  idea: Lightbulb,
  mosque: Landmark,
  moon: Moon,
  sun: Sun,
  // collections (older names kept)
  bedtime: Moon,
  nights_stay: Moon,
  wb_twilight: Sunrise,
  // menu
  home: Home,
  library: Library,
  latest: Clock,
  popular: TrendingUp,
  weekly: CalendarDays,
  others: Users,
};
export const iconFor = (name: string) => ICONS[name] ?? Moon;
/** The icon of a content type. */
export const typeIcon = (kind: string) => ICONS[typeOf(kind).icon] ?? BookText;
/** <TypeIcon kind="lesson" /> — the icon of a content type. */
export const TypeIcon = ({ kind, className }: { kind: string; className?: string }) => createElement(typeIcon(kind), { className });
