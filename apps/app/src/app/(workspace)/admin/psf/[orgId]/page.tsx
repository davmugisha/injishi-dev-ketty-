import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPsfBusinessView } from "@/features/admin/psf/AdminPsfBusinessView";
import { requirePersona } from "@/lib/session";
import { psfBusiness } from "@/server/admin/psf";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminPsf.pageTitle };

/** One business's PSF side for staff: its membership, every renewal, application and payment. */
export default async function AdminPsfBusinessPage({ params }: { params: Promise<{ orgId: string }> }) {
  await requirePersona("AdminPsf");
  const { orgId } = await params;
  try {
    return <AdminPsfBusinessView detail={await psfBusiness(orgId)} />;
  } catch (error) {
    if (error instanceof ApiError && (error.notFound || error.status === 400)) notFound();
    throw error;
  }
}
