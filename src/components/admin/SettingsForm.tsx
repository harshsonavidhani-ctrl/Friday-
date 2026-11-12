"use client";

import { ExternalLink, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { adminRemoveDemoData, saveShopSettings } from "@/app/actions/admin";
import { useT } from "@/components/LangProvider";
import { ConfirmButton, FormMessage, SubmitButton } from "@/components/ui";
import type { Settings } from "@/lib/settings";

type Masked = Omit<Settings, "braveApiKey" | "serperApiKey"> & { braveApiKey: string; serperApiKey: string };

export function SettingsForm({ s, envKeys }: { s: Masked; envKeys: { brave: boolean; serper: boolean } }) {
  const t = useT();
  const [state, action] = useActionState(saveShopSettings, undefined);
  return (
    <form action={action} className="space-y-5 pb-24">
      <Section title={t("Shop details")} desc={t("Shown to retailers on the website and on printed orders.")}>
        <Grid>
          <F name="shopName" label={t("Shop name")} s={s} />
          <F name="ownerName" label={t("Known as")} s={s} hint={t("e.g. Mama")} />
          <F name="tagline" label={t("Tagline")} s={s} />
          <F name="phone" label={t("Phone number")} s={s} type="tel" />
          <F name="whatsapp" label={t("WhatsApp number")} s={s} type="tel" hint={t("Orders are sent here")} />
          <F name="gstin" label="GSTIN" s={s} upper />
          <F name="city" label={t("City")} s={s} />
        </Grid>
        <div>
          <label className="label" htmlFor="address">
            {t("Shop address")}
          </label>
          <textarea id="address" name="address" rows={2} defaultValue={s.address} className="input" />
        </div>
      </Section>

      <Section id="payments" title={t("Payments")} desc={t("Retailers see a QR with the exact amount right after placing an order.")}>
        <Grid>
          <F name="upiId" label={t("UPI ID")} s={s} hint={t("From your shop QR / PhonePe Business / GPay, e.g. laxmi@okaxis")} />
          <F name="upiName" label={t("Name on UPI")} s={s} />
          <F name="upiLimit" label={t("Max amount per QR (₹)")} s={s} hint={t("Most banks allow ₹1,00,000 per UPI payment. Bigger bills are split.")} />
        </Grid>
        <p className="pt-1 text-sm font-semibold text-slate-700">{t("Bank account (for NEFT / RTGS — good for big amounts)")}</p>
        <Grid>
          <F name="bankAccountName" label={t("Account name")} s={s} />
          <F name="bankAccountNumber" label={t("Account number")} s={s} />
          <F name="bankIfsc" label="IFSC" s={s} upper />
          <F name="bankName" label={t("Bank & branch")} s={s} />
        </Grid>
      </Section>

      <Section id="photos" title={t("Automatic photo search")} desc={t("When you type a model name, matching photos appear automatically.")}>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            {t("Open")}{" "}
            <a
              href="https://api-dashboard.search.brave.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-semibold text-brand-700 underline"
            >
              Brave Search API <ExternalLink className="size-3" />
            </a>{" "}
            {t("and sign up (free $5 credit every month ≈ 1,000 photo searches).")}
          </li>
          <li>{t("Choose the “Search” plan, then copy your API key.")}</li>
          <li>{t("Paste it below and press Save.")}</li>
        </ol>
        <Grid>
          {envKeys.brave ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{t("Brave key is set on the server ✓")}</p>
          ) : (
            <F name="braveApiKey" label={t("Brave Search API key")} s={s} />
          )}
          {envKeys.serper ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">{t("Serper key is set on the server ✓")}</p>
          ) : (
            <F name="serperApiKey" label={t("Serper.dev key (optional backup)")} s={s} />
          )}
        </Grid>
      </Section>

      <Section title={t("Display")}>
        <input type="hidden" name="showStockQtyPresent" value="1" />
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="showStockQty" defaultChecked={s.showStockQty === "1"} className="mt-0.5 size-5 accent-brand-800" />
          <span className="text-sm">
            <b className="text-slate-800">{t("Show exact pieces to retailers")}</b>
            <span className="block text-slate-500">{t("Off = they only see “In stock” / “Out of stock”.")}</span>
          </span>
        </label>
        <input type="hidden" name="autoConfirmPresent" value="1" />
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="autoConfirmOrders" defaultChecked={s.autoConfirmOrders !== "0"} className="mt-0.5 size-5 accent-brand-800" />
          <span className="text-sm">
            <b className="text-slate-800">{t("Confirm orders automatically")}</b>
            <span className="block text-slate-500">{t("On = the retailer sees “Order confirmed” right after checkout. Off = you confirm each order yourself.")}</span>
          </span>
        </label>
        <Grid>
          <F name="maxQtyPerItem" label={t("Max pieces per item in one order")} s={s} hint={t("Retailers choose 1 to this number (default 50)")} />
          <F name="lowStockAt" label={t("Low-stock warning at (pcs)")} s={s} />
        </Grid>
      </Section>

      <div className="no-print fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom)+var(--badge,0px))] z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-[var(--badge,0px)] lg:left-[260px]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <FormMessage state={state} />
          </div>
          <SubmitButton className="btn btn-primary btn-lg" pendingText={t("Saving…")}>
            {t("Save settings")}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

/** "Remove demo data" — before giving the website to real retailers. */
export function DemoCleanup() {
  const t = useT();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <ConfirmButton
        className="btn btn-outline btn-sm text-rose-600"
        confirmText={t("Tap again — this cannot be undone")}
        onConfirm={async () => {
          const r = await adminRemoveDemoData();
          if (!r.ok) return setMsg(t(r.error));
          setMsg(r.removed.length ? `${t("Removed")}: ${r.removed.join(", ")}` : t("No demo data left."));
          router.refresh();
        }}
      >
        <Trash className="size-4" /> {t("Remove demo data")}
      </ConfirmButton>
      {msg && <p className="text-sm font-semibold text-emerald-700">{msg}</p>}
    </div>
  );
}

function Section({ title, desc, children, id }: { title: string; desc?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="card scroll-mt-20 space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-bold text-brand-950">{title}</h2>
        {desc && <p className="text-xs text-slate-500">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function F({ name, label, s, hint, type = "text", upper }: { name: keyof Masked; label: string; s: Masked; hint?: string; type?: string; upper?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} type={type} defaultValue={s[name]} className={`input ${upper ? "uppercase" : ""}`} autoComplete="off" />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
