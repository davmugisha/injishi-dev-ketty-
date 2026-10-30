"use client";

import { ErrorBlock, PageContent } from "@injishi/ui";

export default function ReportsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <ErrorBlock title="Couldn't load the guest report" onRetry={reset} />
    </PageContent>
  );
}
