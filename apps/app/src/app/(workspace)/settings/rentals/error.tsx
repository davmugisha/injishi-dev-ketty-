"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function SettingsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="Settings" />
      <ErrorBlock title="Couldn't load your settings" onRetry={reset} />
    </PageContent>
  );
}
