import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { getT } from "@/lib/i18n-server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <LogoMark className="size-14" />
      <h1 className="text-2xl font-extrabold text-brand-950">{t("Page not found")}</h1>
      <p className="text-slate-500">{t("This product or page may have been removed.")}</p>
      <Link href="/" className="btn btn-primary">
        {t("Go to shop")}
      </Link>
    </div>
  );
}
