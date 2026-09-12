import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "The cookies Injishi sets and what each one is for.",
};

export default function Page() {
  return (
    <ComingSoon
      title="Cookie Policy"
      description="The cookies Injishi sets and what each one is for."
      trail={[{ label: "Home", href: "/" }, { label: "Cookie Policy" }]}
    />
  );
}
