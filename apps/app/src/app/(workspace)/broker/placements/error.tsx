"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function PlacementsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Placements" />
      <ErrorBlock title="Couldn't load your placements" onRetry={reset} />
    </PageContent>
  );
}
