import { cookies } from "next/headers";
import { OTP_EMAIL_COOKIE } from "@/lib/otp-email-cookie";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import VerifyOtpPanel from "@/components/auth/verify-otp-panel";
import BrandLogo from "@/components/app/brand-logo";
import ThemeToggleButton from "@/components/app/theme-toggle-button";
import { Badge } from "@injishi/ui";
import { fetchPlatform, isDemo } from "@/data/platform";
import { safeRedirect } from "@/lib/redirect";
import type { OtpMode } from "@/lib/otp-core";

/**
 * /verify-otp (F-S01), rebuilt by ADR-017 slice 2.
 *
 * WHY THE PAGE STAYED A SERVER COMPONENT. ADR-017 describes this route as a
 * Client Component, and the state genuinely is one — it lives in
 * <VerifyOtpPanel/>, which is where AC-16 wants it. The shell around it stayed
 * on the server for two reasons that only appear once you try the other way:
 *
 *  - The route would otherwise lose its <title>. A Client Component cannot
 *    export `metadata`, and ADR-017 rules out adding a `verify-otp/layout.tsx`
 *    to get one back. That would leave a blank browser tab and nothing for a
 *    screen reader to announce — the exact bug `activate/layout.tsx` exists to
 *    record. Keeping the page on the server costs nothing and avoids it.
 *  - `safeRedirect` runs here, before the destination reaches the browser, so
 *    an unchecked `?redirect=` never becomes a prop.
 *
 * The robots directive still comes from the root layout, not from here:
 * metadata merges, so naming a title does not take the layer's rule away. That
 * root is `(app)/layout.tsx` since ADR-021; it was `(auth)/layout.tsx` before,
 * and that file no longer exists.
 */
export const metadata: Metadata = { title: "Enter your code — Injishi" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // From the cookie the send step set (`lib/otp-email-cookie.ts`). A `?email=`
  // is still read, so a link an older build produced keeps working.
  const fromQuery = typeof params.email === "string" ? params.email.trim() : "";
  const email = fromQuery || ((await cookies()).get(OTP_EMAIL_COOKIE)?.value ?? "").trim();
  const redirectTo = safeRedirect(
    typeof params.redirect === "string" ? params.redirect : null,
  );
  // `offline` only ever arrives from a send that could not reach the API.
  // Anything else, including a hand-typed value, is treated as a real code.
  const mode: OtpMode = params.mode === "offline" ? "offline" : "live";

  // Arriving with no address means there is no code to check. Send them back
  // rather than render a form that can only ever fail.
  if (!email) redirect("/sign-in");

  // On the demo the screen states the code (ADR-043, AC-17). Asked of the API,
  // never inferred from the build, and an unanswered question hides it.
  const platform = await fetchPlatform();

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section
        aria-label="What Injishi does"
        className="relative hidden overflow-hidden bg-ramp-1 text-ramp-6 lg:block"
      >
        <picture>
          <source type="image/avif" srcSet="/shared/img/photos/showcase.avif" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/shared/img/photos/showcase.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-ramp-1 via-ramp-1/60 to-ramp-1/30" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <a href="/" aria-label="Injishi — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/shared/img/injishi-extended-white.svg"
              alt="Injishi"
              className="h-8 w-auto"
            />
          </a>
          <div className="max-w-narrow">
            <Badge variant="glass">No password needed</Badge>
            <h2 className="mt-4 font-display text-4xl font-bold leading-tight">
              A code beats a password, every time.
            </h2>
            <p className="mt-3 text-ramp-6/75">
              Nothing to remember, nothing to reuse. Use the same email with
              Google later and it opens this same account — for the stays you
              book, the place you rent, and anything you host.
            </p>
          </div>
          <p className="text-xs text-ramp-6/50">
            Each code works for 10 minutes, and only for you.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-tile">
          <div className="flex items-center justify-between">
            <BrandLogo variant="short" />
            <ThemeToggleButton />
          </div>
          <VerifyOtpPanel
            email={email}
            redirectTo={redirectTo}
            mode={mode}
            demo={isDemo(platform)}
          />
        </div>
      </section>
    </main>
  );
}
