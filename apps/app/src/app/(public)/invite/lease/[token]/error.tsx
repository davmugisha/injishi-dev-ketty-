"use client";

import { ErrorBlock } from "@injishi/ui";

export default function InvitationError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16">
      <ErrorBlock title="Couldn't open your invitation" onRetry={reset} />
    </main>
  );
}
