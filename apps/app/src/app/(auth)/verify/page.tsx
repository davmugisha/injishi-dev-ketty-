import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyView } from "@/features/platform/auth/VerifyView";
import { safeReturn } from "@/lib/return-to";
import { OTP_COOKIE, readPendingSignIn } from "@/lib/session";
import { OTP_TTL_SECONDS, signInOptions } from "@/server/auth";

export const metadata: Metadata = { title: "Check your email" };

/** One-time-code step of sign-in. Needs a code sent in the last ten minutes (cookie set by the sign-in actions). */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeReturn((await searchParams).next);
  const pending = readPendingSignIn((await cookies()).get(OTP_COOKIE)?.value);
  if (!pending) redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const expiresIn = Math.max(0, Math.round((pending.sentAt + OTP_TTL_SECONDS * 1000 - Date.now()) / 1000));
  const options = await signInOptions();
  return (
    <VerifyView
      email={pending.email}
      next={next ?? ""}
      expiresIn={expiresIn}
      demoCode={options.demo?.code ?? null}
      google={options.google}
    />
  );
}
