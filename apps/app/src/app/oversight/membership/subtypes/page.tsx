import { Suspense } from "react";

import { PsfSubtypes } from "@/pms/oversight/screens/psf-subtypes";

/** Suspense, because the console reads its place from the url (`useSearchParams`). */
export default function Page() {
  return (
    <Suspense>
      <PsfSubtypes />
    </Suspense>
  );
}
