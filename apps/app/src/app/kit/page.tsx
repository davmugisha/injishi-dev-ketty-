import { canAccess } from "@injishi/data";
import { kigaliDay } from "@injishi/ui";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { KitGallery } from "@/features/kit/KitGallery";
import { currentPersona } from "@/lib/session";

export const metadata: Metadata = {
  title: "Component gallery",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The shared kit (`packages/ui`) in every state, for building and reviewing screens. Not linked from any
 * navigation. Open in a development build; in a production build only for platform staff (the people who
 * can open the admin console). The only page allowed to show illustrative values.
 */
export default async function KitPage() {
  if (process.env.NODE_ENV === "production") {
    const persona = await currentPersona();
    if (!persona) redirect("/sign-in?next=/kit");
    if (!canAccess(persona.id, "AdminHome")) notFound();
  }
  return <KitGallery today={kigaliDay()} />;
}
