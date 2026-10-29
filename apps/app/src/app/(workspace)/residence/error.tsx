"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function HomeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Home" />
      <ErrorBlock title="Couldn't load your home" onRetry={reset} />
    </PageContent>
  );
}
