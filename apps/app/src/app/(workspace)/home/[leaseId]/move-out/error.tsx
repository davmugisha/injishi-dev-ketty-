"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function MoveOutError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Moving out" />
      <ErrorBlock title="Couldn't load moving out" onRetry={reset} />
    </PageContent>
  );
}
