"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function ExpensesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Expenses" />
      <ErrorBlock title="Couldn't load your expenses" onRetry={reset} />
    </PageContent>
  );
}
