"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function BrokersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Brokers" />
      <ErrorBlock title="Couldn't load your brokers" onRetry={reset} />
    </PageContent>
  );
}
