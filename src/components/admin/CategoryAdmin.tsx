"use client";

import { Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { deleteCategory, saveCategory } from "@/app/actions/admin";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useT } from "@/components/LangProvider";
import { ConfirmButton, FormMessage, SubmitButton } from "@/components/ui";
import { CATEGORY_ICON_KEYS } from "@/lib/constants";

type Cat = { id: number; name: string; icon: string; sortOrder: number; count: number };

export function CategoryRow({ c }: { c?: Cat }) {
  const t = useT();
  const router = useRouter();
  const [state, action] = useActionState(saveCategory, undefined);
  const [icon, setIcon] = useState(c?.icon ?? "package");
  return (
    <form action={action} className="space-y-2 p-4" key={c ? undefined : state?.ok}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <input type="hidden" name="icon" value={icon} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-800">
          <CategoryIcon icon={icon} />
        </span>
        <input name="name" defaultValue={c?.name} placeholder={t("New category name")} className="input min-w-0 flex-1" required />
        <input name="sortOrder" defaultValue={c?.sortOrder ?? 50} inputMode="numeric" className="input num w-16" title={t("Position (smaller shows first)")} aria-label={t("Position")} />
        <SubmitButton className="btn btn-primary btn-sm">{c ? t("Save") : t("Add")}</SubmitButton>
        {c && (
          <ConfirmButton
            onConfirm={async () => {
              await deleteCategory(c.id);
              router.refresh();
            }}
            confirmText={c.count ? t("Delete? {n} products move to “no category”", { n: c.count }) : t("Tap again")}
          >
            <Trash className="size-4" />
          </ConfirmButton>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {CATEGORY_ICON_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setIcon(k)}
            className={`rounded-lg p-1.5 ${icon === k ? "bg-brand-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            aria-label={k}
          >
            <CategoryIcon icon={k} className="size-4" />
          </button>
        ))}
      </div>
      {c && <p className="text-xs text-slate-500">{t("{n} products", { n: c.count })}</p>}
      <FormMessage state={state} />
    </form>
  );
}
