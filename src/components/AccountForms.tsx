"use client";

import { LogOut } from "lucide-react";
import { useActionState } from "react";
import { changePassword, logout, updateProfile } from "@/app/actions/auth";
import { PasswordInput } from "@/components/AuthForms";
import { useT } from "@/components/LangProvider";
import { FormMessage, SubmitButton } from "@/components/ui";

type Profile = { name: string; shopName: string; gstin: string; city: string; address: string };

export function ProfileForm({ me }: { me: Profile }) {
  const t = useT();
  const [state, action] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Your name")} name="name" value={me.name} />
        <Field label={t("Shop name")} name="shopName" value={me.shopName} />
        <Field label={t("City")} name="city" value={me.city} />
        <Field label="GSTIN" name="gstin" value={me.gstin} upper />
      </div>
      <div>
        <label className="label" htmlFor="address">
          {t("Shop address")}
        </label>
        <textarea id="address" name="address" rows={2} defaultValue={me.address} className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>{t("Save profile")}</SubmitButton>
    </form>
  );
}

function Field({ label, name, value, upper }: { label: string; name: string; value: string; upper?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} defaultValue={value} className={`input ${upper ? "uppercase" : ""}`} />
    </div>
  );
}

/** After a one-tap login link the old password is not asked. */
export function PasswordForm({ noCurrent = false }: { noCurrent?: boolean }) {
  const t = useT();
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {!noCurrent && (
          <div>
            <label className="label" htmlFor="current">
              {t("Current password")}
            </label>
            <PasswordInput id="current" name="current" autoComplete="current-password" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="new">
            {t("New password")}
          </label>
          <PasswordInput id="new" name="new" autoComplete="new-password" placeholder={t("At least 6 characters")} />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className={noCurrent ? "btn btn-primary" : "btn btn-outline"}>
        {noCurrent ? t("Save password") : t("Change password")}
      </SubmitButton>
    </form>
  );
}

export function LogoutButton() {
  const t = useT();
  return (
    <form action={logout}>
      <button className="btn btn-outline text-rose-600">
        <LogOut className="size-4" /> {t("Logout")}
      </button>
    </form>
  );
}
