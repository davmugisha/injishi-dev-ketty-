"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function TaxesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Taxes" />
      <ErrorBlock title="Couldn't load your taxes" onRetry={reset} />
    </PageContent>
  );
}
