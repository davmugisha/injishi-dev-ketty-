"use client";

import { useLocale, useTranslations } from "next-intl";
import { isLocale, type Locale } from "@injishi/i18n";
import { useTransition } from "react";
import { saveLanguagePreference } from "./language-actions";

/** Shared language control for staff, officer and account entry points. */
export function LanguageSelect({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("platform.language");
  const active: Locale = isLocale(locale) ? locale : "en";
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={t("label")}
      className={`h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground ${className}`}
      value={active}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value;
        if (!isLocale(next)) return;
        startTransition(async () => {
          try {
            await saveLanguagePreference(next);
          } catch {
            // Keep the browser-level choice if the preference service is unavailable.
          }
          document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
          window.location.reload();
        });
      }}
    >
      <option value="en">{t("english")}</option>
      <option value="fr">{t("french")}</option>
      <option value="rw">{t("kinyarwanda")}</option>
    </select>
  );
}
