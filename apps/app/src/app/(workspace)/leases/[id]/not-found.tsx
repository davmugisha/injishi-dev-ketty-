import { screenHref } from "@injishi/data";
import { ActionLink, EmptyBlock, PageContent, PageHeader } from "@injishi/ui";

export default function LeaseNotFound() {
  return (
    <PageContent>
      <PageHeader title="Lease" />
      <EmptyBlock
        icon="FileText"
        title="That lease was not found"
        description="It may belong to another business, or the link is wrong."
        action={
          <ActionLink href={screenHref("Leases")} icon="ArrowLeft">
            Back to leases
          </ActionLink>
        }
      />
    </PageContent>
  );
}
