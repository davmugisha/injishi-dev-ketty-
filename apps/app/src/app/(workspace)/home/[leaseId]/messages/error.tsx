"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function TenancyMessagesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Messages" />
      <ErrorBlock title="Couldn't load your messages" onRetry={reset} />
    </PageContent>
  );
}
