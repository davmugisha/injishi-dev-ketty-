import { getOtpChallenge } from "@injishi/db";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VerifyView } from "@/features/platform/auth/VerifyView";
import { OTP_COOKIE, safeNext } from "@/lib/session";

export const metadata: Metadata = { title: "Check your email" };

/** One-time-code step of sign-in. Needs a pending challenge (cookie set by the sign-in actions). */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { next } = await searchParams;
  const challengeId = (await cookies()).get(OTP_COOKIE)?.value;
  const challenge = challengeId ? await getOtpChallenge(challengeId) : undefined;
  if (!challenge) redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const expiresIn = Math.max(0, Math.round((challenge.expiresAt.getTime() - Date.now()) / 1000));
  return <VerifyView email={challenge.email} next={safeNext(next) ?? ""} expiresIn={expiresIn} />;
}
