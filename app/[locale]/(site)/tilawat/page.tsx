import type { Metadata } from "next";
import { FilterPage, filterMetadata } from "@/components/filter-page";

export const generateMetadata = (): Promise<Metadata> => filterMetadata("tilawat");

export default function Page() {
  return <FilterPage page="tilawat" />;
}
