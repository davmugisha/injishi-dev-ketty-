"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function LeasesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Leases" />
      <ErrorBlock title="Couldn't load your leases" onRetry={reset} />
    </PageContent>
  );
}
