import { AppShell } from "@/pms/components/app-shell";
import { Calendar } from "@/pms/screens/calendar";

/**
 * Calendar (ADR-018, AC-12).
 *
 * One route, three views, and the views are `?view=` rather than segments. A
 * view is a display mode of one dataset, not a facet of a record, so D-c does
 * not apply and does not need to: nobody sends "the availability view" as a
 * thing in itself, they send a date range.
 */
export default function Page() {
  return (
    <AppShell title="Calendar">
      <Calendar />
    </AppShell>
  );
}
