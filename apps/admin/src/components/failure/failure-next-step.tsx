import { headers } from "next/headers";

import { Button } from "@injishi/ui";

import { RetryButton } from "@/components/failure/retry-button";
import { RETURN_HEADER, returnUrl } from "@/lib/return-path";
import { ADMIN_URL, signInUrl, twoFactorUrl } from "@/lib/sign-in-url";
import type { ApiFailure } from "@/lib/api/server";

/**
 * The one thing a person can do about a failed read, offered where it failed.
 *
 * Every refusal in this console used to be a dead end: a heading, a sentence,
 * and no way on. Three of the six have an obvious move and now offer it —
 * ask again, sign in, enter the emailed code. `denied` and `missing` get none,
 * because there is nothing this console can do about either, and a button that
 * cannot work is worse than no button.
 *
 * A SERVER component, so the detour urls are built the way `StaffBoundary`
 * builds them: an absolute url on this console's origin, from the path the
 * middleware forwarded, which web accepts only because that origin is on its
 * exact-origin allowlist.
 */
export async function FailureNextStep({ reason }: { reason: ApiFailure }) {
  if (reason === "unreachable" || reason === "invalid") {
    return <RetryButton />;
  }

  if (reason === "denied" || reason === "missing") return null;

  const back = returnUrl((await headers()).get(RETURN_HEADER), ADMIN_URL);
  const href = reason === "anonymous" ? signInUrl(back) : twoFactorUrl(back);

  return (
    <div className="mt-4">
      <Button asChild variant="outline" size="sm">
        <a href={href}>
          {reason === "anonymous" ? "Sign in again" : "Enter your code"}
        </a>
      </Button>
    </div>
  );
}
