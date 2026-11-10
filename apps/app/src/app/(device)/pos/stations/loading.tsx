import { KdsSkeleton } from "@/features/pos/kds-parts";

/** While the display loads, the same layout with its cards still being drawn, instead of a blank screen. */
export default function Loading() {
  return <KdsSkeleton />;
}
