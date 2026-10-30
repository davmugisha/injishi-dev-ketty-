import { Suspense } from "react";

import { PsfFees } from "@/pms/oversight/screens/psf-fees";

/** Suspense, because the console reads its place from the url (`useSearchParams`). */
export default function Page() {
  return (
    <Suspense>
      <PsfFees />
    </Suspense>
  );
}
