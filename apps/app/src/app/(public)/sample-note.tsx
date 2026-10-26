"use client";

import { screenByPath } from "@injishi/data";
import { usePathname } from "next/navigation";
import { SampleDataPill } from "@/components/shell/SampleData";

/**
 * The sample-data mark for a public page whose view draws no header of its own (registration, an
 * invitation, the states gallery). A page with the marketplace or public header carries the mark there
 * (`data-sample-mark="header"`), and this note hides itself so the mark is never shown twice.
 */
export function PublicSampleNote() {
  const board = screenByPath(usePathname())?.board;
  return (
    <div className="flex shrink-0 justify-end px-4 pt-2 empty:hidden group-has-[[data-sample-mark=header]]/public:hidden sm:px-8">
      <SampleDataPill board={board} />
    </div>
  );
}
