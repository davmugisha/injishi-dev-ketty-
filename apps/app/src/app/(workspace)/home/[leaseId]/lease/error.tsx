"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function TenancyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Lease" />
      <ErrorBlock title="Couldn't load your lease" onRetry={reset} />
    </PageContent>
  );
}
