import { Suspense } from "react";

import { PsfDecisions } from "@/pms/oversight/screens/psf-decisions";

/** Suspense, because the console reads its place from the url (`useSearchParams`). */
export default function Page() {
  return (
    <Suspense>
      <PsfDecisions />
    </Suspense>
  );
}
