import { Suspense } from "react";

import { PsfQueue } from "@/pms/oversight/screens/psf-queue";

/** Suspense, because the console reads its place from the url (`useSearchParams`). */
export default function Page() {
  return (
    <Suspense>
      <PsfQueue />
    </Suspense>
  );
}
