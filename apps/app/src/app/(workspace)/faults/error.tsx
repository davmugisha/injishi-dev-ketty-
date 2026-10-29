"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function FaultsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Faults" />
      <ErrorBlock title="Couldn't load the faults" onRetry={reset} />
    </PageContent>
  );
}
