import { Suspense } from "react";

import { PsfApplicationPage } from "@/pms/oversight/screens/psf-application";

/** One application, read and decided on its own page. Suspense: the console reads its place from the url. */
export default async function Page({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return (
    <Suspense>
      <PsfApplicationPage applicationId={applicationId} />
    </Suspense>
  );
}
