"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function SetupError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Setup" />
      <ErrorBlock title="Couldn't load your setup" onRetry={reset} />
    </PageContent>
  );
}
