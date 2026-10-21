import type { LegalContent } from "./types";

/**
 * Cookie Policy, DRAFT for legal review (2026-10-21).
 *
 * Every row below is a name the code sets, read from where it is set:
 *
 * - `better-auth.session_token` and `better-auth.state`: Better Auth 1.6's own
 *   names (`MARKETPLACE_COOKIE_PREFIX` in `@injishi/auth/edge`), `__Secure-`
 *   prefixed over https, HttpOnly, widened to `.injishi.com` by
 *   `AUTH_COOKIE_DOMAIN`. Sessions last Better Auth's default 7 days, renewed
 *   at most daily; the state cookie lives 5 minutes, during Google sign-in.
 * - `injishi-demo.*`: `DEMO_COOKIE_PREFIX`, the demo stack only.
 * - `injishi_otp_email`: `lib/otp-email-cookie.ts`, ten minutes.
 * - `injishi_assistant`: `api/public/assistant/assistant-cookie.ts` in the API,
 *   scoped to `/api/v1/assistant`, `ANONYMOUS_RETENTION_DAYS`.
 * - `ij_session` and `ij_otp`: the operator app (`apps/app/src/lib/session.ts`).
 * - `injishi_kiosk`: `KioskGuard` and `KIOSK_COOKIE_MAX_AGE_S` (400 days).
 * - Browser storage: `injishi-theme` (next-themes and `ThemeBoot`),
 *   `injishi:saved-stays`, `injishi:recently-viewed` (hooks/), and
 *   `injishi.checkout:<page>` in session storage (`components/book/checkout.tsx`).
 *
 * Add a row here in the same change that adds a cookie or a storage key.
 */
export const COOKIES: LegalContent = {
  title: "Cookie Policy",
  summary:
    "The cookies and browser storage Injishi uses, what each one does and how long it lasts. There are no advertising cookies.",
  status: "draft",
  lastUpdated: "2026-10-21",
  sections: [
    {
      id: "summary",
      heading: "In short",
      blocks: [
        "Injishi uses a small number of cookies, and sets all of them itself. They keep you signed in, carry you safely through signing in, and remember a few choices you make.",
        "There are no advertising cookies, no tracking pixels and no analytics cookies, and nothing follows you to other websites.",
        "Every cookie here is either strictly necessary or remembers something you chose, so we do not ask you to accept cookies [TO CONFIRM: that no consent banner is required for these cookies under Law No 058/2021].",
      ],
    },
    {
      id: "what-they-are",
      heading: "What cookies and browser storage are",
      blocks: [
        "A cookie is a small piece of text a website asks your browser to keep and send back on later visits. Browser storage (local storage and session storage) is similar, but stays in your browser: the page reads it, and it is never sent to our servers.",
        "Local storage lasts until you clear it. Session storage lasts until you close the tab.",
      ],
    },
    {
      id: "cookies",
      heading: "Cookies we set",
      blocks: [
        {
          table: {
            columns: ["Name", "What it does", "How long", "Kind"],
            rows: [
              [
                "`__Secure-better-auth.session_token`",
                "Keeps you signed in. It is set for injishi.com and its subdomains, so the website and our API both recognise you, and scripts on the page cannot read it.",
                "7 days, renewed while you use Injishi. Deleted when you sign out.",
                "Strictly necessary",
              ],
              [
                "`__Secure-better-auth.state`",
                "Protects a Google sign-in from being forged while you are on Google's page.",
                "5 minutes",
                "Strictly necessary",
              ],
              [
                "`injishi_otp_email`",
                "Remembers which email address a sign-in code went to, between asking for the code and typing it, so your address never appears in the page address.",
                "10 minutes",
                "Strictly necessary",
              ],
              [
                "`injishi_assistant`",
                "Keeps your Ask Injishi conversation together when you are not signed in. Only the assistant's own requests carry it, and scripts on the page cannot read it.",
                "7 days",
                "Strictly necessary",
              ],
              [
                "`ij_session`, `ij_otp`",
                "Used by the business workspace: the first keeps a business user signed in to it, the second remembers where a sign-in code went.",
                "Until the session ends; 10 minutes",
                "Strictly necessary",
              ],
              [
                "`injishi_kiosk`",
                "Pairs a business's shared attendance tablet with its branch so staff can clock in. It is set only on that tablet.",
                "400 days, or until the tablet is unpaired",
                "Strictly necessary",
              ],
            ],
          },
        },
        "Our demo site, www-demo.injishi.com, names its sign-in cookies `injishi-demo` instead of `better-auth`, so a demo session can never be mistaken for a real one.",
      ],
    },
    {
      id: "storage",
      heading: "Browser storage we use",
      blocks: [
        {
          table: {
            columns: ["Name", "What it does", "How long", "Kind"],
            rows: [
              [
                "`injishi-theme`",
                "Remembers whether you chose the light or the dark look.",
                "Until you clear it",
                "Preference",
              ],
              [
                "`injishi:saved-stays`",
                "The stays you saved with the heart button, kept in this browser.",
                "Until you clear it",
                "Preference",
              ],
              [
                "`injishi:recently-viewed`",
                "The last 12 stays you opened, so we can show them to you again.",
                "Until you clear it",
                "Preference",
              ],
              [
                "`injishi.checkout:` followed by the page address",
                "If checkout sends you to sign in, keeps your chosen rate, payment network and mobile money number for the trip back. A card number is never stored.",
                "Until you return to checkout or close the tab",
                "Strictly necessary",
              ],
            ],
          },
        },
        "The business workspace also remembers, in local storage, which workspace you last used and your display settings.",
        "In the signed in parts of Injishi, a service worker keeps copies of static files (code, fonts, icons and images) so pages load faster. It never stores pages or your personal data.",
      ],
    },
    {
      id: "others",
      heading: "Other services",
      blocks: [
        {
          list: [
            "Maps: when you open a map, your browser loads the map images from OpenFreeMap or OpenStreetMap. They receive your IP address and the area you are viewing, as any website you load does.",
            "Google: if you choose to sign in with Google, Google's own pages may set their cookies, under Google's policy.",
            "Analytics: we are adding privacy-friendly, cookie-free analytics that count visits without identifying you. It sets no cookies, and it is off until configured.",
          ],
        },
        "We use no advertising cookies, no social media pixels and no tracking scripts.",
      ],
    },
    {
      id: "choices",
      heading: "Your choices",
      blocks: [
        "You can delete cookies and browser storage in your browser's settings at any time, or set the browser to block them.",
        "If you block the strictly necessary cookies, you cannot sign in or book, and Ask Injishi cannot keep a conversation while you are signed out. Clearing local storage empties your saved and recently viewed stays and resets your theme.",
        "Signing out deletes the sign-in cookie.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        "We update this page whenever we add, remove or change a cookie or a storage key, and change the date at the top.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      blocks: [
        "Questions about cookies: [support@injishi.com](mailto:support@injishi.com). How we handle personal data is in our [Privacy Policy](/legal/privacy).",
      ],
    },
  ],
};
