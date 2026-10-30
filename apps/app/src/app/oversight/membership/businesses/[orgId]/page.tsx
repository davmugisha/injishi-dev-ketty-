import { Suspense } from "react";

import { PsfBusinessPage } from "@/pms/oversight/screens/psf-business";

/** One business, with its whole payment history. Suspense: the console reads its place from the url. */
export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  return (
    <Suspense>
      <PsfBusinessPage orgId={orgId} />
    </Suspense>
  );
}
