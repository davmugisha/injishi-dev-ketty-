import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ApplicationPage } from "@/features/apply/ApplicationPage";
import { readApplication, sessionCookie } from "@/features/apply/application";

export const metadata: Metadata = { title: "Your application · Injishi", robots: { index: false, follow: false } };

/** An applicant's own progress page: the link from their emails, opened with a code we mail them. */
export default async function ApplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = (await cookies()).get(sessionCookie(token).name)?.value;
  const read = await readApplication(token, session);
  return <ApplicationPage token={token} read={read} />;
}
