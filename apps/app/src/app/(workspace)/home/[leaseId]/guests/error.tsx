"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function TenancyGuestsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Guests" />
      <ErrorBlock title="Couldn't load your guests" onRetry={reset} />
    </PageContent>
  );
}
