"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function BrokerHomeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Home" />
      <ErrorBlock title="Couldn't load your broker home" onRetry={reset} />
    </PageContent>
  );
}
