import { Suspense } from "react";

import { PsfOverview } from "@/pms/oversight/screens/psf-overview";

/** Suspense, because the console reads its place from the url (`useSearchParams`). */
export default function Page() {
  return (
    <Suspense>
      <PsfOverview />
    </Suspense>
  );
}
