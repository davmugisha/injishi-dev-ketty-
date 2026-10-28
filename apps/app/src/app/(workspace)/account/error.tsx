"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function AccountError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Account" />
      <ErrorBlock title="Couldn't load your account" onRetry={reset} />
    </PageContent>
  );
}
