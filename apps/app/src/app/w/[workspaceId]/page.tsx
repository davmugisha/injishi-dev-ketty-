"use client";

/**
 * A bare workspace address has no screen of its own; its home screen is the job.
 *
 * `/w/<id>` is a perfectly reasonable thing to bookmark or to type, and it is
 * where every way into a workspace arrives (the root, the switcher, the
 * old-address shim, "Back to your workspace"). It opens the screen this PERSON
 * opens on, which ADR-069 D-f chooses per grant: the Dashboard for the owner,
 * the manager and the desk, Finance for the accountant, People for HR, the
 * phone for the housekeeper, the Rent roll for a residence. `homeFor` is the
 * one place that mapping lives, and it only ever answers with a door the grant
 * opens.
 *
 * `replace` rather than `push`, so Back leaves the app instead of bouncing off
 * this resolver forever.
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { homeFor } from "@/pms/lib/home";
import { usePms } from "@/pms/store";

export default function Page() {
  const router = useRouter();
  const params = useParams<{ workspaceId: string }>();
  const { state } = usePms();

  useEffect(() => {
    const id =
      typeof params.workspaceId === "string" ? params.workspaceId : null;
    if (!id) return;
    // The layout has already refused an id this person does not hold, so a
    // missing grant here means the answer has simply not arrived yet.
    const grant = state.grants?.find((g) => g.workspaceId === id);
    if (!grant) return;
    router.replace(homeFor(grant));
  }, [params, state.grants, router]);

  return null;
}
