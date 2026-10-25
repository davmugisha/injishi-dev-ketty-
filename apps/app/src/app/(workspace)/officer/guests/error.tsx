"use client";

import { ErrorBlock, PageContent } from "@injishi/ui";

export default function GuestsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <ErrorBlock title="Couldn't load the guests in your area" onRetry={reset} />
    </PageContent>
  );
}
