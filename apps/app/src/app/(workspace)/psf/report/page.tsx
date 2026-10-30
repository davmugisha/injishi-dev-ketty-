import { redirect } from "next/navigation";

/** The reports moved to one page each (2026-10-30); the old address opens the overview. */
export default function PsfReportIndex() {
  redirect("/psf/report/overview");
}
