"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function TenancyFaultsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Faults" />
      <ErrorBlock title="Couldn't load your faults" onRetry={reset} />
    </PageContent>
  );
}
