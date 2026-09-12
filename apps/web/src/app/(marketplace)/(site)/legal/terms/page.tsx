import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms you agree to when booking or hosting through Injishi.",
};

export default function Page() {
  return (
    <ComingSoon
      title="Terms of Service"
      description="The terms you agree to when booking or hosting through Injishi."
      trail={[{ label: "Home", href: "/" }, { label: "Terms of Service" }]}
    />
  );
}
