import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { legalRobots } from "@/data/legal/documents";
import { TERMS } from "@/data/legal/terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms you agree to when booking or hosting through Injishi.",
  alternates: { canonical: "/legal/terms" },
  robots: legalRobots(TERMS),
};

/** The words are `data/legal/terms.ts`; the checkout links to its `#cancellation`. */
export default function Page() {
  return <LegalDocument content={TERMS} />;
}
