import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { PLATFORM_SESSION_COOKIE_NAMES } from "@injishi/auth/edge";
import { catalogs, DEFAULT_LOCALE, isLocale, type Locale } from "@injishi/i18n";

/**
 * Which language this request is in.
 *
 * The order is the one a person expects:
 *
 *   1. the signed-in person's saved profile preference;
 *   2. the browser's saved `NEXT_LOCALE` choice;
 *   3. English, regardless of browser language or timezone.
 *
 * Chooses a LANGUAGE, never a country: `fr-BE` and `fr-RW` are both `fr`, and a
 * tag this app does not speak is never forced. Reading the profile and cookie
 * makes the render dynamic, which is the price of a locale that follows a
 * person rather than a URL. When the public site grows `[lang]`
 * segments, this file becomes the fallback for the routes that keep cookies.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const chosen = store.get("NEXT_LOCALE")?.value;
  const cookieLocale = isLocale(chosen) ? chosen : null;
  const sessionCookies = store
    .getAll()
    .filter((cookie) => PLATFORM_SESSION_COOKIE_NAMES.includes(cookie.name));
  let savedLocale: Locale | null = null;
  if (sessionCookies.length) {
    try {
      const cookie = sessionCookies.map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join("; ");
      const apiUrl = (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
      const response = await fetch(`${apiUrl}/api/v1/me/preferences/language`, {
        headers: { cookie },
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      });
      if (response.ok) {
        const body: unknown = await response.json();
        if (body && typeof body === "object" && "locale" in body && isLocale(body.locale)) savedLocale = body.locale;
      }
    } catch {
      // Keep rendering from the local choice/default when the API preference service is unavailable.
    }
  }
  const locale = savedLocale ?? cookieLocale ?? DEFAULT_LOCALE;

  return { locale, messages: catalogs[locale] };
});
