"use client";

import { Chip } from "@heroui/react";
import { Icon } from "@injishi/ui";
import { sampleCollectionsByBoard } from "@/lib/coverage.generated";

/**
 * Says so when the current screen still draws sample data from the fixture store instead of the
 * business's own records in Injishi (scripts/data-coverage.mjs counts them per screen). Screens fully on
 * live or static data show nothing.
 */
export function SampleDataPill({ board }: { board: string | null | undefined }) {
  const count = board ? (sampleCollectionsByBoard[board] ?? 0) : 0;
  if (count === 0) return null;
  const note = `${count} ${count === 1 ? "part" : "parts"} of this screen still show sample data, not your business’s records.`;
  return (
    <Chip variant="soft" color="warning" className="whitespace-nowrap" title={note} aria-label={note}>
      <Icon name="Database" className="size-3.5" />
      <Chip.Label>Sample data</Chip.Label>
    </Chip>
  );
}
