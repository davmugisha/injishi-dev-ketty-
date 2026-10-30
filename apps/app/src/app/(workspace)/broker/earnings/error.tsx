"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function EarningsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Earnings" />
      <ErrorBlock title="Couldn't load your earnings" onRetry={reset} />
    </PageContent>
  );
}
