import { PERSONA_IDS, personas, screens } from "@injishi/data";
import type { Metadata } from "next";
import { SignInView } from "@/features/platform/auth/SignInView";
import { returnTargetFrom } from "@/lib/return-to";
import { requireScreen } from "@/lib/session";
import { signInErrorMessage } from "@/lib/sign-in-messages";
import { signInOptions } from "@/server/auth";

export const metadata: Metadata = { title: screens.SignIn.pageTitle };

/**
 * Sign-in. On the demo stack it also lists every persona, one press away (the API accepts one fixed code there);
 * anywhere else the list is not drawn, because a press would mail a code to an address nobody owns.
 *
 * Two apps send people here: this app's gate with `?next=` (a screen here) and web with `?redirect=` (a page
 * on web, such as a checkout quote or an invitation link). Both become one return target (`return-to.ts`).
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redirect?: string; as?: string; error?: string }>;
}) {
  await requireScreen("SignIn");
  const { next, redirect, as, error } = await searchParams;
  const highlight = as && (PERSONA_IDS as string[]).includes(as) ? as : null;
  const options = await signInOptions();
  return (
    <SignInView
      // The demo's people only: the landlord and tenant shells are real people's, with no demo account.
      personas={PERSONA_IDS.map((id) => personas[id]).filter((p) => p.email)}
      next={returnTargetFrom({ next, redirect }) ?? ""}
      highlight={highlight}
      demo={options.demo}
      google={options.google}
      notice={signInErrorMessage(error)}
    />
  );
}
