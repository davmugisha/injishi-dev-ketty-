import { redirect } from "next/navigation";

/** A fault's link from an email opens the list with that fault's panel. */
export default async function FaultLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/faults?fault=${encodeURIComponent(id)}`);
}
