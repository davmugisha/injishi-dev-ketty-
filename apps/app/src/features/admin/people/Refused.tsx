import { EmptyBlock, PageContent, PageHeader } from "@injishi/ui";

/** People, when the API refused this staffer: a missing step-up code, or a role that cannot read accounts. */
export function Refused({ code }: { code: string | null | undefined }) {
  return (
    <PageContent>
      <PageHeader title="People" />
      <EmptyBlock
        icon="ShieldKeyhole"
        title={code === "two_factor_required" ? "Enter the code we emailed you" : "Your staff role cannot see people"}
        description={
          code === "two_factor_required" ? "Sign in again to get a code, then come back." : "Ask a super admin for access to people and roles."
        }
      />
    </PageContent>
  );
}
