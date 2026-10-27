"use client";

import { ErrorBlock, PageContent } from "@injishi/ui";

export default function CoverageError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <ErrorBlock title="Couldn't load coverage" onRetry={reset} />
    </PageContent>
  );
}
