import { PERSONA_IDS, personas, screenByPath, screens } from "@injishi/data";
import type { Metadata } from "next";
import { SignInView } from "@/features/platform/auth/SignInView";
import { requireScreen, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: screens.SignIn.pageTitle };

/** Legacy-style sign-in with every artifact persona (dummy data; every one-time code is 123456). */
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
    />
  );
}
