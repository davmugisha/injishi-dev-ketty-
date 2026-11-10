"use server";

import { isLocale, type Locale } from "@injishi/i18n";
import { currentAccount, currentApi } from "@/lib/session";

/** Save a signed-in person's account-wide language preference. Anonymous choices stay in the locale cookie. */
export async function saveLanguagePreference(locale: Locale): Promise<void> {
  if (!isLocale(locale) || !(await currentAccount())) return;
  await (await currentApi()).patch("/api/v1/me/preferences/language", { locale });
}
