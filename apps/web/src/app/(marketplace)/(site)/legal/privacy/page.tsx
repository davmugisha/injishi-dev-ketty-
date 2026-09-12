import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Injishi collects, stores, and uses your data.",
};

export default function Page() {
  return (
    <ComingSoon
      title="Privacy Policy"
      description="How Injishi collects, stores, and uses your data."
      trail={[{ label: "Home", href: "/" }, { label: "Privacy Policy" }]}
    />
  );
}
