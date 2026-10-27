"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function BrokerPlansError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Broker plans" />
      <ErrorBlock title="Couldn't load broker plans" onRetry={reset} />
    </PageContent>
  );
}
