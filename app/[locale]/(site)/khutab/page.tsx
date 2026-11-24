import type { Metadata } from "next";
import { FilterPage, filterMetadata } from "@/components/filter-page";

export const generateMetadata = (): Promise<Metadata> => filterMetadata("khutab");

export default function Page() {
  return <FilterPage page="khutab" />;
}
