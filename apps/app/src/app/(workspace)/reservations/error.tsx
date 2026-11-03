"use client";

import { AreaError } from "@/components/shell/WorkspaceNav";

export default function PageError({ reset }: { error: Error; reset: () => void }) {
  return <AreaError heading="Bookings" title="Couldn't load the bookings" onRetry={reset} />;
}
