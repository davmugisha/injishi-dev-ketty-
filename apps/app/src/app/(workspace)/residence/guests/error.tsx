"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function LandlordGuestsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="My guests" />
      <ErrorBlock title="Couldn't load your guests" onRetry={reset} />
    </PageContent>
  );
}
