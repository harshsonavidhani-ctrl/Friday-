"use client";

import { LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { RatesStudio as Studio } from "./RatesStudio";

// Runs only in the browser: it keeps unsaved rate changes on the phone (so a call
// or a closed app never loses Mama's work).
const RatesStudio = dynamic(() => import("./RatesStudio").then((m) => m.RatesStudio), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center gap-3 p-16 text-lg font-semibold text-slate-500">
      <LoaderCircle className="size-6 animate-spin" />
    </div>
  ),
});

export function RatesStudioLoader(props: ComponentProps<typeof Studio>) {
  return <RatesStudio {...props} />;
}
