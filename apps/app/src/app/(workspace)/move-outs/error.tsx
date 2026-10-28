"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function MoveOutsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Move-outs" />
      <ErrorBlock title="Couldn't load the move-outs" onRetry={reset} />
    </PageContent>
  );
}
