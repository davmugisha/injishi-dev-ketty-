"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function TenancyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Rent" />
      <ErrorBlock title="Couldn't load your rent" onRetry={reset} />
    </PageContent>
  );
}
