import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { legalRobots } from "@/data/legal/documents";
import { PRIVACY } from "@/data/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Injishi collects, stores, and uses your data.",
  alternates: { canonical: "/legal/privacy" },
  robots: legalRobots(PRIVACY),
};

/** The words are `data/legal/privacy.ts`. */
export default function Page() {
  return <LegalDocument content={PRIVACY} />;
}
