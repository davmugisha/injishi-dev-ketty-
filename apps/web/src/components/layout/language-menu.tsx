"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@injishi/web-ui";
import { cn } from "@injishi/utils";
import { isLocale, LOCALES, type Locale } from "@injishi/i18n";
import { API_URL } from "@/lib/api";

/**
 * The language switcher in the site header and the registration shell.
 *
 * It used to be an inert control: it opened, held a selection, and changed
 * nothing, because no locale layer read the value. It is the one call site the
 * file used to promise would change the day a locale layer landed, and this is
 * that change.
 *
 * The choice is a `NEXT_LOCALE` cookie, read by `i18n/request.ts` on the next
 * request. A reload rather than `router.refresh()`: the language also changes
 * `<html lang>` and the formatters, and a document load is the one path that
 * cannot leave half the page in the old language.
 *
 * The names are endonyms — "Français", not "French" — because a person looking
 * for their language recognises it written in itself, not in the language they
 * cannot read.
 */
const NAMES: Readonly<Record<Locale, string>> = {
  en: "English",
  fr: "Français",
  rw: "Kinyarwanda",
};

export function LanguageMenu({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [chosen, setChosen] = useState<Locale | null>(null);

  const active: Locale = isLocale(locale) ? locale : "en";
  const current = chosen ?? active;

  async function choose(next: string) {
    if (!isLocale(next)) return;
    setChosen(next);
    // A year, the root, and lax: a language is a preference, not a session.
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    try {
      await fetch(`${API_URL}/api/v1/me/preferences/language`, {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: next }),
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      // The locale cookie still applies to this browser if the account API is unavailable.
    }
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // The label carries the CURRENT language, not just the action. A
          // globe on its own tells a screen reader nothing about what is
          // selected, and this control's whole state is which one is.
          aria-label={t("changeLanguage", { language: NAMES[current] })}
          className={cn("group", className)}
        >
          <Globe
            width={20}
            height={20}
            className="opacity-70 transition-opacity duration-travel group-hover:opacity-100"
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max border border-border">
        <span className="block px-3 py-2 text-2xs font-medium text-muted-foreground">{t("language")}</span>
        <DropdownMenuRadioGroup value={current} onValueChange={choose}>
          {LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {NAMES[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
