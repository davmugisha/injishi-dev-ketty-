"use client";

import { ErrorBlock, PageContent, PageHeader } from "@injishi/ui";

export default function AdminPsfError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PageContent>
      <PageHeader title="PSF memberships" />
      <ErrorBlock title="Couldn't load PSF memberships" onRetry={reset} />
    </PageContent>
  );
}
