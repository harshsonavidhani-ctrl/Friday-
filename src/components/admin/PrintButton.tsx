"use client";

import { Printer } from "lucide-react";
import { useT } from "@/components/LangProvider";

export function PrintButton({ className = "btn btn-primary" }: { className?: string }) {
  const t = useT();
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="size-4" /> {t("Print / Save PDF")}
    </button>
  );
}
