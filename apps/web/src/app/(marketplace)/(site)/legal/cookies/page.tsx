import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { COOKIES } from "@/data/legal/cookies";
import { legalRobots } from "@/data/legal/documents";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "The cookies Injishi sets and what each one is for.",
  alternates: { canonical: "/legal/cookies" },
  robots: legalRobots(COOKIES),
};

/** The words are `data/legal/cookies.ts`. */
export default function Page() {
  return <LegalDocument content={COOKIES} />;
}
