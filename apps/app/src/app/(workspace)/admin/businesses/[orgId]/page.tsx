import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Refused } from "@/features/admin/people/Refused";
import { BusinessView } from "@/features/admin/registrations/BusinessView";
import { requirePersona } from "@/lib/session";
import { staffAccess } from "@/server/admin/leaders";
import { psfBusiness } from "@/server/admin/psf";
import {
  businessDetail,
  businessPeople,
  businessProperties,
  businessSubscription,
  registrationTimeline,
} from "@/server/admin/registrations";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminBusinesses.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A read this staffer may not make is left out of the page rather than failing it. */
async function optional<T>(allowed: boolean, read: () => Promise<T>): Promise<T | null> {
  if (!allowed) return null;
  try {
    return await read();
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) return null;
    throw error;
  }
}

/**
 * One business for Injishi staff (2026-11-09): where its registration stands with its history, its people
 * (each opening their page), its properties, its money for finance staff, and its PSF record.
 */
export default async function AdminBusinessPage({ params }: { params: Promise<{ orgId: string }> }) {
  await requirePersona("AdminBusinesses");
  const { orgId } = await params;
  if (!UUID.test(orgId)) notFound();
  try {
    const [detail, access] = await Promise.all([businessDetail(orgId), staffAccess()]);
    const has = (p: string) => access.permissions.includes(p);
    const [timeline, people, properties, money, psf] = await Promise.all([
      registrationTimeline(orgId).catch(() => []),
      optional(true, () => businessPeople(orgId)),
      optional(true, () => businessProperties(orgId)),
      optional(has("admin.finance.view"), () => businessSubscription(orgId)),
      // PSF's register is where membership is decided; a business it never saw answers 404.
      psfBusiness(orgId).catch(() => null),
    ]);
    return (
      <BusinessView
        org={detail}
        timeline={timeline}
        people={people?.items ?? null}
        properties={properties?.items ?? null}
        money={money}
        canSeePeople={has("admin.user.view")}
        psf={psf ? psf.business : null}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (error instanceof ApiError && error.forbidden) return <Refused code={error.code} />;
    throw error;
  }
}

export const dynamic = "force-dynamic";
