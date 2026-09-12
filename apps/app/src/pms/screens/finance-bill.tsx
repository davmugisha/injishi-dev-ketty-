"use client";

/**
 * One bill in Finance: the address of a folio that bills no record (ADR-044,
 * D-c, AC-4).
 *
 * A folio lives under the record it bills. A guest's bill is on its stay, or on
 * its reservation before the guest arrives, so this route is a 404 for one: it
 * would be a second address, which is the defect D-c exists to remove. What is
 * left is the `master`, `group` and `house` folio, which bills nothing and is a
 * record itself. No code can open one yet (P-O1), so today this route answers
 * only with its 404, and its happy path waits for the first such row.
 *
 * The record names itself by its folio number (D-e 3). There is no guest to name.
 */

import { notFound } from "next/navigation";

import { Bill, FOLIO_KIND } from "./bill";
import { ObjectPage } from "../components/object-page";
import { EmptyState, LoadFailed, Skeleton } from "../components/ui";
import { ApiError } from "../data/api";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useFolio } from "../data/ops";
import { dshortIso } from "../lib/format";
import { folioHref } from "../lib/objects";
import { workspaceBase } from "../lib/nav";

export function FinanceBill({ id }: { id: string }) {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const mayRead = can("folio.charge");
  // Gated on `folio.charge` server side, so a caller without it never asks.
  const query = useFolio(mayRead ? workspaceId : null, id);

  if (!mayRead) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>{reasonFor("folio.charge")}</EmptyState>
    );
  }

  if (query.isPending) return <Skeleton height={320} />;

  if (query.isError) {
    // A bill this workspace does not hold is a 404, the same answer as a made up
    // id. Anything else is ours to own, with a way to ask again.
    if (query.error instanceof ApiError && query.error.status === 404) notFound();
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load this bill. Every charge on it is still there — this is on
        our side, not an empty statement.
      </LoadFailed>
    );
  }

  const folio = query.data;
  // Only once the folio has answered: this route renders a bill whose one
  // address is this route, and refuses every other.
  if (folioHref(workspaceId, folio) !== `${workspaceBase(workspaceId)}/finance/bills/${folio.id}`) {
    notFound();
  }

  return (
    <ObjectPage
      title={folio.folioNumber}
      subtitle={`${FOLIO_KIND[folio.folioType]} · opened ${dshortIso(folio.openedAt)}`}
      lenses={[]}
      active=""
    >
      <Bill id={folio.id} />
    </ObjectPage>
  );
}
