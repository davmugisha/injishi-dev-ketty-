import { redirectLegacyPath } from "@/pms/lib/legacy-redirect";

/**
 * The old `/landlord/*` address (ADR-018, D-d).
 *
 * No screen is served from a workspace kind any more; this segment is the shim
 * and nothing else, and it goes when its log shows two quiet weeks (D-h).
 */
export default async function Page({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const { rest } = await params;
  return redirectLegacyPath("landlord", rest);
}
