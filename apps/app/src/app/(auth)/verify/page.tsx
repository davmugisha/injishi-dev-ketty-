import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyView } from "@/features/platform/auth/VerifyView";
import { OTP_COOKIE, readPendingSignIn, safeNext } from "@/lib/session";
import { demoSignInCode, OTP_TTL_SECONDS } from "@/server/auth";

export const metadata: Metadata = { title: "Check your email" };

/** One-time-code step of sign-in. Needs a code sent in the last ten minutes (cookie set by the sign-in actions). */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { next } = await searchParams;
  const pending = readPendingSignIn((await cookies()).get(OTP_COOKIE)?.value);
  if (!pending) redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const expiresIn = Math.max(0, Math.round((pending.sentAt + OTP_TTL_SECONDS * 1000 - Date.now()) / 1000));
  return (
    <VerifyView
      email={pending.email}
      next={safeNext(next) ?? ""}
      expiresIn={expiresIn}
      demoCode={await demoSignInCode()}
    />
  );
}
