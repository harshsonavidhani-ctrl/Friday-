"use client";

import { CopyPlus, Eye, EyeOff, LoaderCircle, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteProduct, duplicateProduct, setProductActive } from "@/app/actions/admin";
import { useT } from "@/components/LangProvider";
import { ConfirmButton } from "@/components/ui";

export function ProductRowActions({ id, isActive, afterDelete }: { id: number; isActive: boolean; afterDelete?: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await duplicateProduct(id);
            if (r.ok) router.push(`/admin/products/${r.id}`);
          })
        }
        title={t("Make a copy — useful for similar models")}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <CopyPlus className="size-4" />} {t("Copy")}
      </button>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={pending}
        onClick={() => start(async () => void (await setProductActive(id, !isActive)))}
      >
        {isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        {isActive ? t("Hide") : t("Show")}
      </button>
      <ConfirmButton
        onConfirm={async () => {
          const r = await deleteProduct(id);
          if (r.ok && afterDelete) router.push(afterDelete);
        }}
        confirmText={t("Tap again to delete")}
      >
        <Trash className="size-4" /> {t("Delete")}
      </ConfirmButton>
    </div>
  );
}
