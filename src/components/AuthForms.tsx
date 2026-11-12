"use client";

import { Eye, EyeOff, LogIn, MessageCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { login, loginWithLink, register, requestLoginHelp } from "@/app/actions/auth";
import { useT } from "@/components/LangProvider";
import { FormMessage, SubmitButton } from "@/components/ui";
import { waLink } from "@/lib/format";

export function PasswordInput({
  name,
  id,
  autoComplete,
  placeholder,
}: {
  name: string;
  id: string;
  autoComplete: string;
  placeholder?: string;
}) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="input pr-11"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-600"
        aria-label={show ? t("Hide password") : t("Show password")}
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export function LoginForm({ next, mode = "shop" }: { next: string; mode?: "shop" | "admin" }) {
  const t = useT();
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label className="label" htmlFor="phone">
          {t("Mobile number")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={t("10-digit mobile")}
          className="input num"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t("Password")}
        </label>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText={t("Logging in…")}>
        {t("Login")}
      </SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const t = useT();
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">
            {t("Your name")}
          </label>
          <input id="name" name="name" autoComplete="name" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="shopName">
            {t("Shop name")}
          </label>
          <input id="shopName" name="shopName" autoComplete="organization" className="input" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="phone">
          {t("Mobile number")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={t("10-digit mobile")}
          className="input num"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t("Create password")}
        </label>
        <PasswordInput id="password" name="password" autoComplete="new-password" placeholder={t("At least 6 characters")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="city">
            {t("City")}
          </label>
          <input id="city" name="city" autoComplete="address-level2" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="gstin">
            GSTIN <span className="font-normal text-slate-400">({t("optional")})</span>
          </label>
          <input id="gstin" name="gstin" className="input uppercase" maxLength={15} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="address">
          {t("Shop address")} <span className="font-normal text-slate-400">({t("for parcels")})</span>
        </label>
        <textarea id="address" name="address" rows={2} autoComplete="street-address" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText={t("Creating account…")}>
        {t("Register shop")}
      </SubmitButton>
    </form>
  );
}

export function LinkLoginForm({ token }: { token: string }) {
  const t = useT();
  const [state, action] = useActionState(loginWithLink, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText={t("Logging in…")}>
        <LogIn className="size-5" /> {t("Login now")}
      </SubmitButton>
    </form>
  );
}

export function ForgotForm({ shopWhatsapp, ownerName }: { shopWhatsapp: string; ownerName: string }) {
  const t = useT();
  const [state, action] = useActionState(requestLoginHelp, undefined);
  const [phone, setPhone] = useState("");
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="phone">
          {t("Your registered mobile number")}
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder={t("10-digit mobile")}
          className="input num"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </div>
      <FormMessage state={state} />
      {!state?.ok && (
        <SubmitButton className="btn btn-primary btn-lg w-full" pendingText={t("Sending…")}>
          {t("Ask {name} for a login link", { name: ownerName })}
        </SubmitButton>
      )}
      {shopWhatsapp && (
        <a
          href={waLink(shopWhatsapp, t("Hello {name}, I forgot my password. Please send me a login link. My mobile: {phone}", { name: ownerName, phone }))}
          target="_blank"
          rel="noreferrer"
          className="btn btn-whatsapp w-full"
        >
          <MessageCircle className="size-4" /> {t("Message on WhatsApp")}
        </a>
      )}
    </form>
  );
}
