import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/AuthForms";
import { getT } from "@/lib/i18n-server";

export const metadata: Metadata = { title: "Register your shop" };

export default async function RegisterPage() {
  const t = await getT();
  return (
    <div className="card space-y-5 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-950">{t("Register your shop")}</h1>
        <p className="text-sm text-slate-500">{t("After a quick approval you'll see wholesale rates and can order directly.")}</p>
      </div>
      <RegisterForm />
      <p className="text-center text-sm text-slate-600">
        {t("Already registered?")}{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          {t("Login")}
        </Link>
      </p>
    </div>
  );
}
