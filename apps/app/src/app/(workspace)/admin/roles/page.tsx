import { screens } from "@injishi/data";
import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";
import type { Metadata } from "next";
import { RolesView } from "@/features/admin/roles/roles-view";
import { requirePersona } from "@/lib/session";
import { staffAccess } from "@/server/admin/leaders";
import { roleCatalog } from "@/server/admin/people";
import { ApiError } from "@/server/api";

export const metadata: Metadata = { title: screens.AdminRoles.pageTitle };

/**
 * Staff roles and the permissions matrix (2026-11-02), read from the admin API as this staffer
 * (`admin.role.view`: super admin, ops, compliance). Only a super admin sees the controls to change them.
 */
export default async function AdminRolesPage() {
  await requirePersona("AdminRoles");
  try {
    const [catalog, access] = await Promise.all([roleCatalog(), staffAccess()]);
    return (
      <RolesView
        catalog={catalog}
        canManage={access.permissions.includes("admin.user.role.grant")}
        held={access.permissions}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.forbidden) {
      const stepUp = error.code === "two_factor_required";
      return (
        <PageContent>
          <PageHeader title="Roles" />
          <EmptyBlock
            icon="ShieldKeyhole"
            title={stepUp ? "Enter the code we emailed you" : "Your staff role cannot see roles"}
            description={
              stepUp ? "Sign in again to get a code, then come back." : "Ask a super admin for access to roles."
            }
          />
        </PageContent>
      );
    }
    throw error;
  }
}
