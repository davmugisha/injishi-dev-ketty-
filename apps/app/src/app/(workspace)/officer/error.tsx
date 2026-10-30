"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function OfficerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Reviews" />
      <ErrorBlock title="Couldn't load your queue" onRetry={reset} />
    </PageContent>
  );
}
