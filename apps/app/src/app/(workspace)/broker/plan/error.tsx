"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function PlanError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Plan" />
      <ErrorBlock title="Couldn't load your plan" onRetry={reset} />
    </PageContent>
  );
}
