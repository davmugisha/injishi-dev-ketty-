import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@injishi/ui";

import { RetryButton } from "@/components/failure/retry-button";
import { RoleLensSeed } from "@/components/shell/role-lens-seed";
import { StaffAccessProvider } from "@/components/shell/staff-access-provider";
import { RETURN_HEADER, returnUrl } from "@/lib/return-path";
import { ADMIN_URL, signInUrl, twoFactorUrl } from "@/lib/sign-in-url";
import { readStaffAccess } from "@/lib/staff";

/**
 * What the admin console renders before it knows who is looking (F-S01, ADR-029).
 *
 * A SERVER component, and that is the point. It used to be a client component:
 * the console shipped, the browser painted "Checking your access…", and only
 * then did a `fetch` decide whether the person watching was allowed to be
 * there. Everything up to that decision — the shell, the route, the fact that
 * this origin is a control tower — had already reached them. A sidebar listing
 * Finance and Compliance is itself a disclosure. Deciding here means an
 * unauthorised caller receives no console markup at all, because `children` is
 * never rendered on the refusing branches.
 *
 * `middleware.ts` proved a session cookie resolves to a live session; that is
 * all it can prove. This asks the second question — is this account platform
 * staff — and it is still not the security boundary. `StaffGuard` on the API is.
 * This is what stops the console handing out its own shape.
 *
 * It wraps the whole shell rather than each screen, because a per-screen check
 * is a check some screen will not have.
 *
 * The five outcomes stay five. `lib/staff.ts` records why, and the short
 * version is that merging any two of them produces a wrong sentence — two of
 * the wrong sentences are loops, and one of those loops signs a working
 * staffer out because the API blinked. The fifth, `step_up`, is the emailed
 * code (F-S02): folded into `denied` it tells a staffer who holds the power
 * that they do not; folded into `anonymous` it re-signs-in someone who already
 * has.
 */
export async function StaffBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, access } = await readStaffAccess();
  // Where to come back to after a detour to web: the page actually asked for,
  // forwarded by middleware.ts and re-checked in lib/return-path.ts.
  const back = returnUrl((await headers()).get(RETURN_HEADER), ADMIN_URL);

  if (status === "anonymous") {
    // The one state that means "sign in", and the only one that may redirect.
    // There is ONE sign-in screen and it lives on web; this console must never
    // grow its own. Reaching here means the session died between the
    // middleware's gate and this read — rare — and `back` still returns the
    // staffer to the page they asked for, not the console's root.
    redirect(signInUrl(back));
  }

  if (status === "step_up") {
    // Signed in and staff, but the emailed code (F-S02) is still owed. Web
    // owns the code screen, exactly as it owns sign-in — this console must not
    // grow a second one. `back` is an absolute url on admin's own origin — the
    // page asked for, re-checked against that origin in lib/return-path.ts —
    // which web's `safeRedirect` accepts only because NEXT_PUBLIC_ADMIN_URL is
    // on its exact-origin allowlist. Anything else lands on web's HOME, so
    // this cannot be turned into an open redirect by editing the address bar.
    redirect(twoFactorUrl(back));
  }

  if (status === "unreachable") {
    // Says nothing about this person's access, so it must not be worded as a
    // refusal — and must not redirect, or a staffer whose API hiccuped is
    // signed out for it.
    return (
      <Centered
        title="Can't reach the platform"
        body={
          "The admin API didn't answer. This says nothing about your access, " +
          "and nothing you did caused it. Ask again once it's back."
        }
      >
        {/* A real way on. This screen used to end here, which left a staffer
            whose API blinked with a sentence and no control — and a refusal
            with nothing to press reads as a door, not a wait. */}
        <div className="flex justify-center">
          <RetryButton label="Try again" />
        </div>
      </Centered>
    );
  }

  if (status === "denied") {
    // Signed in, and not staff. Sending them to the sign-in screen they have
    // already passed would bounce them straight back here.
    return (
      <Centered
        title="Not a staff account"
        body={
          "You're signed in, but this account doesn't hold a platform staff " +
          "role, so the control tower stays closed. Ask a Super Admin if you " +
          "need one."
        }
      >
        {/* The other honest move: the person may hold a staff account and be
            signed in as someone else. Web owns the sign-in screen, and it
            renders the form for a signed-in caller rather than bouncing them,
            so this is a way in rather than a loop back to here. */}
        <div className="flex justify-center">
          <Button asChild variant="outline" size="sm">
            <a href={signInUrl(back)}>Sign in with a different account</a>
          </Button>
        </div>
      </Centered>
    );
  }

  // The resolved access goes to the client chrome as a prop, so the sidebar's
  // first frame is already filtered on the server's `permissions[]` (ADR-053).
  return (
    <StaffAccessProvider access={access}>
      <RoleLensSeed roles={access.roles}>{children}</RoleLensSeed>
    </StaffAccessProvider>
  );
}

/**
 * The one layout for every pre-console state, so they cannot drift apart.
 *
 * `children` is the way out of this state, and every state that has one passes
 * it. It arrives rather than appears (`animate-arrive`, 480ms): this is the
 * first thing a person sees on a screen that is refusing them, and a refusal
 * that snaps into place reads as a slammed door.
 */
function Centered({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="app-canvas grid min-h-screen place-items-center p-6">
      <div className="max-w-[42ch] animate-arrive text-center">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {body ? (
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
