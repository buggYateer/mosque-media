import { AudioLines, BookText, CalendarDays, Clock, Home, Library, Mic, Moon, Sunrise, TrendingUp, Users, type LucideIcon } from "lucide-react";

/** Icon names used in data/config (kinds, collections, menu) → icons. */
export const ICONS: Record<string, LucideIcon> = {
  tilawa: AudioLines,
  lesson: BookText,
  khutba: Mic,
  bedtime: Moon,
  nights_stay: Moon,
  wb_twilight: Sunrise,
  home: Home,
  library: Library,
  latest: Clock,
  popular: TrendingUp,
  weekly: CalendarDays,
  others: Users,
};
export const iconFor = (name: string) => ICONS[name] ?? Moon;
