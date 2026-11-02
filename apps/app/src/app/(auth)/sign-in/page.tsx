import { PERSONA_IDS, personas, screens } from "@injishi/data";
import type { Metadata } from "next";
import { SignInView } from "@/features/platform/auth/SignInView";
import { returnTargetFrom } from "@/lib/return-to";
import { requireScreen } from "@/lib/session";
import { signInErrorMessage } from "@/lib/sign-in-messages";
import { demoRoster, signInOptions } from "@/server/auth";

export const metadata: Metadata = { title: screens.SignIn.pageTitle };

/**
 * Sign-in. On the demo stack it also lists every persona whose account exists, one press away (the API accepts one
 * fixed code there); anywhere else, or with nobody to list, the list is not drawn, because a press would mail a code
 * to an address nobody owns.
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
  // The API's own demo people: the accounts that exist on this database (the `@demo.injishi.com`
  // seeds, the PSF managers among them). Empty off the demo, and on a database without the seeds.
  const seeded = options.demo ? await demoRoster() : [];
  const exists = new Set(seeded.map((r) => r.email.toLowerCase()));
  // This app's personas only where their account exists (2026-11-02): a database without the seeds
  // would otherwise offer "Sign in as Didier" for an account nobody can open. The landlord and tenant
  // shells are real people's, with no demo account.
  const listed = PERSONA_IDS.map((id) => personas[id]).filter((p) => p.email && exists.has(p.email.toLowerCase()));
  // Less any this app already lists by the same email.
  const roster = seeded.filter((r) => !listed.some((p) => p.email.toLowerCase() === r.email.toLowerCase()));
  return (
    <SignInView
      personas={listed}
      roster={roster}
      next={returnTargetFrom({ next, redirect }) ?? ""}
      highlight={highlight}
      demo={options.demo}
      google={options.google}
      notice={signInErrorMessage(error)}
    />
  );
}
