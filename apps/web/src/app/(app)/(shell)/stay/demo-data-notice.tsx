import { Icon } from "@/components/app/icon";

/**
 * The notice every screen that renders `data/dining.ts` has to carry.
 *
 * IT IS COLOCATED WITH THE ROUTES RATHER THAN SITTING IN `components/stay/`,
 * which is where the rest of this feature's pieces live. The reason is that
 * this is not a reusable part: it is a property OF these two screens, in the
 * same way `step-documents.tsx` is a property of the registration wizard and
 * lives beside it. Every screen under `/stay` that prints a fabricated price
 * has to render it, and keeping it in the route folder is what makes that
 * visible to the next person opening the folder.
 *
 * WHY IT EXISTS. That fixture attaches invented outlets, invented dishes and
 * invented prices to NAMED REAL HOTELS — the Kigali Serena, the Mille Collines,
 * the Radisson. `data/properties.ts` refuses to fabricate reviews or host
 * profiles for a named business for exactly that reason, and the dining
 * catalogue crosses the line on purpose, because the rule it demonstrates ("a
 * product tied to a hotel shows to that hotel's guests") is untestable without
 * a real property slug. The safeguard therefore moves to the surface: nobody
 * reads one of these menus without also reading that it is not the hotel's.
 *
 * WHY IT IS QUIET AND NOT A WARNING BANNER. It is shown on every screen of the
 * feature, on every visit. A red alarm repeated five times is read once and
 * then never again, and it also makes a working demo look broken to the very
 * audience it is being shown to. A dotted note in the muted role stays legible
 * without pretending something has gone wrong.
 *
 * The literal words "Demo data" are load-bearing — contract C31 is observed by
 * a check that greps for them — so do not reword the label. `detail` is where a
 * screen says which of its numbers are invented.
 */
export function DemoDataNotice({ detail }: { detail: string }) {
  return (
    <aside
      className="flex items-start gap-3 rounded-card border border-dashed border-input bg-secondary px-4 py-3 text-secondary-foreground"
      aria-label="Demo data notice"
    >
      <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="text-xs leading-relaxed">
        <span className="font-semibold">Demo data.</span>{" "}
        <span className="text-muted-foreground">{detail}</span>
      </p>
    </aside>
  );
}

/**
 * The wording used wherever a menu or a price from `data/dining.ts` is on
 * screen. One sentence, one place, so the hub and the order screen cannot come
 * to describe the same fabrication in two different ways.
 */
export const DINING_DEMO_DETAIL =
  "The outlets, dishes and prices below were written for this demonstration. " +
  "They did not come from the hotel and no order placed here reaches a kitchen.";
