import type { Metadata } from "next";
import ShowcasePanel from "@/components/auth/showcase-panel";
import SignInForm from "@/components/auth/sign-in-form";
import GoogleButton from "@/components/auth/google-button";
import ThemeToggleButton from "@/components/app/theme-toggle-button";
import { AppleMark, InjishiGlyph } from "@/components/icons/marks";
import { Button } from "@injishi/ui";
import { fetchDemoPersonas, fetchPlatform, isDemo } from "@/data/platform";
import { sendCodeAction } from "@/lib/otp.server";
import { safeRedirect } from "@/lib/redirect";

/**
 * /sign-in (F-S01), rebuilt by ADR-017.
 *
 * This page used to be a frozen HTML capture: ten stylesheets, 69 KB of CSS to
 * paint one form, a font sheet fetched from Google that duplicated fonts
 * already on disk, and its auth attached to the DOM after hydration. It lives
 * in `(app)/(entry)` now (ADR-021 moved it there from `(auth)`), beside
 * `/verify-otp`, `/activate`, `/register` and `/claim-org`, so moving between
 * the steps of signing in is no longer a full document load.
 *
 * IT IS A SERVER COMPONENT ON PURPOSE, and that is what makes the form work
 * with scripting off. It reads `?redirect=`, resolves it through
 * `safeRedirect`'s exact-origin allowlist, and BINDS the resolved value to the
 * Server Action. A `<form action={…}>` posts FormData and nothing else, so a
 * bound argument is the only way the target survives a scriptless submit — and
 * binding the already-resolved value means the allowlist runs before the
 * action can ever see an attacker-supplied string. A hidden input would put
 * that string back in reach; reading the query inside the action would too.
 */
export const metadata: Metadata = {
  title: "Sign in — Injishi",
  description: "Sign in to Injishi to manage your stays, leases and bookings.",
};

/**
 * One literal, wired to the Apple button by aria-describedby. AC-15 checks the
 * wording, so the sentence is unchanged — what changed is that it is VISIBLE.
 * It was `sr-only`, which meant a sighted person got a dead grey button and no
 * reason for it, and the only people told why were the ones using a screen
 * reader. A disabled control owes everybody its reason.
 */
const APPLE_UNAVAILABLE = "Sign in with Apple isn't available yet.";

/**
 * Why this person is looking at a sign-in screen, when we know.
 *
 * Arriving here mid-task — from checkout, from a receipt link — and being met
 * with "Welcome to Injishi" and nothing else reads as a wall: it says nothing
 * about what happens to the thing they were doing. The destination has ALREADY
 * been through `safeRedirect`, so this only reads it; it never decides it, and
 * a value it does not recognise simply produces no line.
 */
const RETURN_BASE = "http://sign-in.invalid";

function reasonFor(destination: string, unwrap = true): string | null {
  let url: URL;
  try {
    url = new URL(destination, RETURN_BASE);
  } catch {
    return null;
  }

  // Another Injishi app bounced them here; its own gate sent an absolute url.
  if (url.origin !== RETURN_BASE) {
    return "Sign in to open your workspace. We'll take you straight back.";
  }

  // `/start` is the resolver, which carries the real destination along with it.
  if (unwrap && url.pathname === "/start") {
    const inner = url.searchParams.get("redirect");
    return inner ? reasonFor(inner, false) : null;
  }

  const path = url.pathname;
  if (path === "/book" || path.startsWith("/book/")) {
    return "Sign in to confirm your booking. We'll bring you straight back to your quote.";
  }
  if (path.startsWith("/receipt")) {
    return "Sign in to open your receipt. We'll bring you straight back to it.";
  }
  if (path.startsWith("/trips") || path.startsWith("/stay")) {
    return "Sign in to see your trips. We'll take you straight there.";
  }
  if (path.startsWith("/inbox")) {
    return "Sign in to read your messages. We'll take you straight there.";
  }
  // The register gate sends signed-out visitors here rather than signing them
  // in itself (ADR-060): one sign-in screen, with Google on it.
  if (path.startsWith("/register")) {
    return "Sign in to register your business. A business belongs to the person who registers it, so we need to know who that is. We'll bring you straight back.";
  }
  if (path.startsWith("/saved")) {
    return "Sign in to see the stays you've saved.";
  }
  if (path.startsWith("/lease")) {
    return "Sign in to open your lease. We'll take you straight there.";
  }
  if (path.startsWith("/two-factor")) {
    return "Sign in to carry on. There's one more check after this.";
  }
  return null;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.redirect === "string" ? params.redirect : null;
  const redirectTo = safeRedirect(raw);
  const bounced = params.error === "google";
  // Only when they were sent here from somewhere: with no `?redirect=`,
  // `safeRedirect` answers with the default home, which is not a reason.
  const reason = raw ? reasonFor(redirectTo) : null;

  const send = sendCodeAction.bind(null, redirectTo);

  // On the demo only: the persona picker and when the data was last reset
  // (ADR-043, AC-18, AC-19). Asked of the API; an unanswered question is
  // production's screen, with no picker.
  const platform = await fetchPlatform();
  const demo = isDemo(platform)
    ? { personas: (await fetchDemoPersonas()) ?? [], seededAt: platform?.seededAt ?? null }
    : undefined;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background p-2 font-sans text-sm text-foreground antialiased">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggleButton />
      </div>

      {/* Showcase: hidden below lg, exactly as the capture hid it. */}
      <div className="relative hidden h-full overflow-hidden rounded-card lg:flex lg:w-1/2">
        <ShowcasePanel />
      </div>

      <div className="relative flex h-full w-full flex-col scrollbar overflow-y-auto rounded-card lg:w-1/2">
        <div className="relative flex w-full flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-tile flex-col items-stretch gap-9">
            <a href="/" aria-label="Injishi" className="mx-auto" data-cy="logo-link">
              <InjishiGlyph className="h-11 w-11 text-foreground" width={44} height={44} />
            </a>

            <div className="flex w-full flex-col gap-6 text-foreground">
              <header className="flex flex-col gap-2 text-center">
                <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
                  Welcome to Injishi
                </h1>
                {reason ? (
                  <p className="text-sm text-muted-foreground" data-cy="sign-in-reason">
                    {reason}
                  </p>
                ) : null}
              </header>

              <p className="-mb-4 text-center text-xs font-medium text-muted-foreground">
                Continue with
              </p>

              <div className="flex flex-col gap-2">
                {/* Not on the demo: it signs in with the persona picker and a
                    fixed code, and has no Google client of its own, so the
                    button could only ever end in "couldn't start". */}
                {demo ? null : (
                  <GoogleButton redirectTo={redirectTo} bounced={bounced} />
                )}

                <Button
                  variant="secondary"
                  className="w-full"
                  disabled
                  aria-describedby="apple-unavailable"
                  data-cy="apple-button"
                >
                  <AppleMark className="size-4 shrink-0" />
                  Continue with Apple
                </Button>
                <span
                  id="apple-unavailable"
                  className="text-center text-xs text-muted-foreground"
                >
                  {APPLE_UNAVAILABLE}
                </span>
              </div>

              <div className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>Or continue with email</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <SignInForm action={send} demo={demo} />

              {/* "Don't you have an account? Sign up" pointed at /register,
                  which is the BUSINESS registration wizard — so a guest with no
                  account was sent to apply as a company. There is nothing to
                  sign up for: an email and a code makes the account. */}
              <div className="flex flex-col items-center gap-2 text-xs font-medium text-muted-foreground">
                <p className="font-normal leading-normal">
                  New here? Enter your email — we&rsquo;ll make your account when
                  you confirm the code.
                </p>
                <p className="font-normal leading-normal">
                  Registering a business?{" "}
                  <a
                    href="/register"
                    className="text-foreground hover:underline"
                    data-cy="sign-up-link"
                  >
                    Start here
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
