"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function UnitsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Units" />
      <ErrorBlock title="Couldn't load your units" onRetry={reset} />
    </PageContent>
  );
}
