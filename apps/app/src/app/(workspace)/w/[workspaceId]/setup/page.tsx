import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PropertySetupView } from "@/features/shared/PropertySetupView";
import { currentAccount } from "@/lib/session";
import { setupPath } from "@/lib/setup-path";
import { requestContext } from "@/server/data";
import { type Place, provinces, readSetup, SetupRefusal } from "@/server/mutations/setup";

export const metadata: Metadata = { title: "Set up your property" };

const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * "Set up your property", for one business the signed-in person holds. The web's In review page links here
 * (web forwards `/w/*` to this app). Signed out, it sends the person to sign in and back. A workspace that is not
 * theirs is a 404, the same answer as one that does not exist.
 */
export default async function PropertySetupPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  if (!(await currentAccount())) redirect(`/sign-in?next=${encodeURIComponent(setupPath(workspaceId))}`);
  const ctx = await requestContext();
  let data: Awaited<ReturnType<typeof readSetup>>;
  try {
    data = await readSetup(ctx, workspaceId);
  } catch (error) {
    if (error instanceof SetupRefusal) notFound();
    throw error;
  }
  // The address picker is needed only when a business has no property yet (approval normally creates one).
  const places: Place[] = data.open && !data.property ? await provinces(ctx) : [];
  return <PropertySetupView data={data} provinces={places} webUrl={WEB_URL} />;
}
