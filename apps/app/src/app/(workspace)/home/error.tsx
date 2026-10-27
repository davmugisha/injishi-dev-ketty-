"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function HomeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="My home" />
      <ErrorBlock title="Couldn't load your homes" onRetry={reset} />
    </PageContent>
  );
}
