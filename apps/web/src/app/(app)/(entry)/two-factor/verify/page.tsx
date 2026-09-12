import type { Metadata } from "next";

import BrandLogo from "@/components/app/brand-logo";
import ThemeToggleButton from "@/components/app/theme-toggle-button";
import TwoFactorVerifyPanel from "@/components/auth/two-factor-verify-panel";
import { fetchPlatform, isDemo } from "@/data/platform";
import { safeRedirect } from "@/lib/redirect";

export const metadata: Metadata = { title: "Two-factor code — Injishi" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const redirectTo = safeRedirect(
    typeof params.redirect === "string" ? params.redirect : "/start",
  );
  // On the demo the step-up code is the published one (ADR-043, AC-17). Asked
  // of the API; an unanswered question hides it.
  const demo = isDemo(await fetchPlatform());
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-tile">
        <div className="flex items-center justify-between">
          <BrandLogo variant="short" />
          <ThemeToggleButton />
        </div>
        <div className="mt-8">
          <TwoFactorVerifyPanel redirectTo={redirectTo} demo={demo} />
        </div>
      </div>
    </main>
  );
}
