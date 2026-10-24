import { Suspense } from "react";

import { MembershipBusinesses } from "@/pms/oversight/screens/membership-businesses";

/** Suspense, because the console reads its place from the url (`useSearchParams`). */
export default function Page() {
  return (
    <Suspense>
      <MembershipBusinesses />
    </Suspense>
  );
}
