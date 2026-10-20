import { PERSONA_IDS, personas, screenByPath, screens } from "@injishi/data";
import type { Metadata } from "next";
import { SignInView } from "@/features/platform/auth/SignInView";
import { requireScreen, safeNext } from "@/lib/session";
import { demoPlatform } from "@/server/auth";

export const metadata: Metadata = { title: screens.SignIn.pageTitle };

/**
 * Sign-in. On the demo stack it also lists every persona, one press away (the API accepts one fixed code there);
 * anywhere else the list is not drawn, because a press would mail a code to an address nobody owns.
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; as?: string }> }) {
  await requireScreen("SignIn");
  const { next, as } = await searchParams;
  const target = safeNext(next);
  const highlight = as && (PERSONA_IDS as string[]).includes(as) ? as : null;
  return (
    <SignInView
      personas={PERSONA_IDS.map((id) => personas[id])}
      next={target && screenByPath(target.split("?")[0]) ? target : ""}
      highlight={highlight}
      demo={await demoPlatform()}
    />
  );
}
