import { AppShell } from "@/pms/components/app-shell";
import { Services } from "@/pms/screens/services";

/**
 * Services · the outlets lens (ADR-050 slice 4).
 *
 * A lens is its own route SEGMENT (ADR-018, D-c), so it is something one
 * person can send another. The shell allows it through the `services`
 * segment, the same door as the other three lenses.
 */
export default function Page() {
  return (
    <AppShell title="Services">
      <Services lens="outlets" />
    </AppShell>
  );
}
