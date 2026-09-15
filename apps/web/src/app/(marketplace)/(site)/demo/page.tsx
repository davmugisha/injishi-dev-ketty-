import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DemoGuide } from "./demo-guide";
import { fetchDemoPersonas, fetchPlatform, isDemo } from "@/data/platform";

/**
 * /demo: the guide a stakeholder reads before signing in as anyone.
 *
 * EXISTS ONLY ON THE DEMO. The API is asked (`GET /api/v1/platform`), and any
 * answer other than a positive "demo" — production, staging, an unreachable or
 * unreadable API — is a 404, the same fail-closed rule the sign in picker
 * follows. So production never publishes a page that names the demo code.
 *
 * Dynamic on purpose: a build that prerendered this against an unreachable API
 * would bake the 404 in, and a build against the demo would bake the roster.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How the Injishi demo works",
  description:
    "What Injishi is, who uses it, and how to sign in as a hotel receptionist, a landlord, a government officer or a guest in one step.",
  robots: { index: false, follow: false },
};

export default async function DemoPage() {
  const platform = await fetchPlatform();
  if (!isDemo(platform)) notFound();

  const personas = (await fetchDemoPersonas()) ?? [];

  return <DemoGuide personas={personas} seededAt={platform?.seededAt ?? null} />;
}
