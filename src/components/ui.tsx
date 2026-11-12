"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/components/LangProvider";
import type { FormState } from "@/lib/validate";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <LoaderCircle className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Shows a server message; English messages are translated when Hindi is on. */
export function FormMessage({ state }: { state: FormState | { error?: string; ok?: string } }) {
  const t = useT();
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
        {t(state.error)}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
        {t(state.ok)}
      </p>
    );
  return null;
}

export function CopyButton({ text, label, className = "btn btn-outline btn-sm" }: { text: string; label?: string; className?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const el = document.createElement("textarea");
          el.value = text;
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          el.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? t("Copied") : (label ?? t("Copy"))}
    </button>
  );
}

/** Two-tap confirm instead of browser popups (works better on phones). */
export function ConfirmButton({
  onConfirm,
  children,
  confirmText,
  className = "btn btn-outline btn-sm",
  confirmClassName = "btn btn-danger btn-sm",
}: {
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
  confirmText?: string;
  className?: string;
  confirmClassName?: string;
}) {
  const t = useT();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={armed ? confirmClassName : className}
      onBlur={() => setArmed(false)}
      onClick={async () => {
        if (!armed) {
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
          return;
        }
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
          setArmed(false);
        }
      }}
    >
      {busy && <LoaderCircle className="size-4 animate-spin" />}
      {armed ? (confirmText ?? t("Tap again to confirm")) : children}
    </button>
  );
}
