import { AppShell } from "@/pms/components/app-shell";
import { Placeholder } from "@/pms/components/placeholder";

/**
 * Sales & events: a destination of the Navigation board with no screen yet.
 *
 * The door exists so the shape of the product is visible to whoever it is for
 * (its gate is in `lib/nav.ts`), and what it opens says what the screen will
 * hold and where that work happens today. Never a made-up number.
 */
export default function Page() {
  return (
    <AppShell title="Sales & events">
      <Placeholder screenKey="sales" />
    </AppShell>
  );
}
