import type { Metadata } from "next";
import { RatesStudioLoader } from "@/components/admin/RatesStudioLoader";
import { getRatesStudioData } from "@/lib/rates-data";

export const metadata: Metadata = { title: "Update rates" };

export default async function RatesPage() {
  return <RatesStudioLoader {...await getRatesStudioData()} />;
}
