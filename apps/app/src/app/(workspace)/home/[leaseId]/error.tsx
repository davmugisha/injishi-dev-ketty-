"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function TenancyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="My home" />
      <ErrorBlock title="Couldn't load your home" onRetry={reset} />
    </PageContent>
  );
}
