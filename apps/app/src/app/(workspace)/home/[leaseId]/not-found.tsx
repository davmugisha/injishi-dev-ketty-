import { ActionLink, EmptyBlock, PageContent, PageHeader } from "@injishi/ui";

export default function TenancyNotFound() {
  return (
    <PageContent>
      <PageHeader title="My home" />
      <EmptyBlock
        icon="House"
        title="That home was not found"
        description="The link may be for another account. Sign in with the email the lease was sent to."
        action={
          <ActionLink href="/home" icon="ArrowLeft">
            My home
          </ActionLink>
        }
      />
    </PageContent>
  );
}
