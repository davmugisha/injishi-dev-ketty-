"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function NewLeaseError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="New lease" />
      <ErrorBlock title="Couldn't open the new lease form" onRetry={reset} />
    </PageContent>
  );
}
