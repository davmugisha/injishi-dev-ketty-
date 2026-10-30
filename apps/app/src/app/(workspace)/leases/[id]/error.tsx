"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function LeaseRecordError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Lease" />
      <ErrorBlock title="Couldn't load this lease" onRetry={reset} />
    </PageContent>
  );
}
