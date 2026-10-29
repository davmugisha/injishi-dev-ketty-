"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function HomesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Homes" />
      <ErrorBlock title="Couldn't load the homes" onRetry={reset} />
    </PageContent>
  );
}
