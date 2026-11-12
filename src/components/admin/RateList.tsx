"use client";

import { MessageCircle, Printer, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useT } from "@/components/LangProvider";
import { CopyButton } from "@/components/ui";
import { formatDate, formatINR, waLink } from "@/lib/format";

type Row = {
  id: number;
  name: string;
  label: string;
  price: number;
  mrp: number | null;
  stock: number;
  categoryId: number | null;
  categoryName: string | null;
};

export function RateList({
  rows,
  cats,
  shopName,
  phone,
  site,
}: {
  rows: Row[];
  cats: { id: number; name: string }[];
  shopName: string;
  phone: string;
  site: string;
}) {
  const t = useT();
  const [picked, setPicked] = useState<number[]>([]);
  const [inStock, setInStock] = useState(true);
  const [withMrp, setWithMrp] = useState(false);
  const [withLink, setWithLink] = useState(true);
  const [custom, setCustom] = useState<string | null>(null);

  const text = useMemo(() => {
    const list = rows.filter((r) => (!inStock || r.stock > 0) && (!picked.length || (r.categoryId && picked.includes(r.categoryId))));
    const groups = new Map<string, Row[]>();
    for (const r of list) {
      const g = r.categoryName ? t(r.categoryName) : t("Other");
      groups.set(g, [...(groups.get(g) ?? []), r]);
    }
    const lines = [`*${shopName} — ${t("Today's Rates")}*`, formatDate(new Date(), false), ""];
    for (const [g, items] of groups) {
      lines.push(`*${g}*`);
      for (const r of items) {
        lines.push(
          `${r.name}${r.label ? ` ${r.label}` : ""} — ${formatINR(r.price)}${withMrp && r.mrp ? ` (MRP ${formatINR(r.mrp)})` : ""}${!inStock && r.stock <= 0 ? ` (${t("out of stock")})` : ""}`,
        );
      }
      lines.push("");
    }
    if (withLink) lines.push(`${t("Order online")}: ${site}`);
    if (phone) lines.push(`${t("Call / WhatsApp")}: ${phone}`);
    return lines.join("\n").trim();
  }, [rows, picked, inStock, withMrp, withLink, shopName, phone, site, t]);

  const final = custom ?? text;
  const count = rows.filter((r) => (!inStock || r.stock > 0) && (!picked.length || (r.categoryId && picked.includes(r.categoryId)))).length;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text: final });
        return;
      } catch {}
    }
    window.open(waLink("", final), "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-slate-700">{t("Which categories?")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => (setPicked([]), setCustom(null))} className={`chip ${!picked.length ? "chip-active" : ""}`}>
            {t("All")}
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCustom(null);
                setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]));
              }}
              className={`chip ${picked.includes(c.id) ? "chip-active" : ""}`}
            >
              {t(c.name)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { v: inStock, set: setInStock, label: t("Only in-stock") },
            { v: withMrp, set: setWithMrp, label: t("Show MRP") },
            { v: withLink, set: setWithLink, label: t("Add website link") },
          ].map((o) => (
            <label key={o.label} className="chip cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={o.v}
                onChange={(e) => {
                  o.set(e.target.checked);
                  setCustom(null);
                }}
                className="size-4 accent-brand-800"
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">{t("Message preview")} · {t("{n} items", { n: count })}</p>
          {custom !== null && (
            <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setCustom(null)}>
              {t("Reset")}
            </button>
          )}
        </div>
        <textarea value={final} onChange={(e) => setCustom(e.target.value)} rows={14} className="input num font-mono text-sm" />
        <div className="flex flex-wrap gap-2">
          <a href={waLink("", final)} target="_blank" rel="noreferrer" className="btn btn-whatsapp">
            <MessageCircle className="size-4" /> {t("Send on WhatsApp")}
          </a>
          <button type="button" onClick={share} className="btn btn-outline">
            <Share2 className="size-4" /> {t("Share…")}
          </button>
          <CopyButton text={final} className="btn btn-outline" />
          <button type="button" onClick={() => window.print()} className="btn btn-outline">
            <Printer className="size-4" /> {t("Print")}
          </button>
        </div>
        <p className="text-xs text-slate-500">{t("Tip: send it to your retailer WhatsApp group or broadcast list every morning.")}</p>
      </div>

      <pre className="hidden whitespace-pre-wrap font-sans text-sm print:block">{final.replace(/\*/g, "")}</pre>
    </div>
  );
}
