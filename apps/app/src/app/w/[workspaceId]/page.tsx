"use client";

/**
 * A bare workspace address has no screen of its own; its home screen is the job.
 *
 * `/w/<id>` is a perfectly reasonable thing to bookmark or to type, so it opens
 * whatever that workspace opens on — a hotel on Today, a landlord on the rent
 * roll. `workspaceHome` is the one place that mapping lives.
 *
 * `replace` rather than `push`, so Back leaves the app instead of bouncing off
 * this resolver forever.
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { workspaceHome } from "@/pms/lib/nav";
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
    router.replace(workspaceHome(grant.key, id));
  }, [params, state.grants, router]);

  return null;
}
