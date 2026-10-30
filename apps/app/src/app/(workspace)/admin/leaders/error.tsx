"use client";

import { ErrorBlock, PageContent } from "@injishi/ui";

export default function LeadersError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <ErrorBlock title="Couldn't load local leaders and officers" onRetry={reset} />
    </PageContent>
  );
}
