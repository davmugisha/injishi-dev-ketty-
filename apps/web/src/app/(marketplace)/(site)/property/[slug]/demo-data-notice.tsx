import { Info } from "lucide-react";

/**
 * The notice both property routes have to carry once they print a menu price.
 *
 * IT IS COLOCATED WITH THE ROUTES RATHER THAN LIVING IN `components/property/`,
 * for the same reason its twin under `app/(app)/(shell)/stay/` is colocated
 * there: it is not a reusable part, it is a property OF these two screens. The
 * property page and the menu page beneath it are the only public surfaces that
 * render `data/dining.ts`, and keeping the notice in the route folder is what
 * makes that obligation visible to the next person who opens the folder.
 *
 * It is a SECOND copy of the stay-side component rather than an import of it,
 * and that is deliberate. `app/(app)/(shell)/stay/demo-data-notice.tsx` is
 * written against the app shell — it draws its icon from `components/app/icon`,
 * which `_injishi-public.css` does not list as a source, so every class inside
 * it would compile to nothing on a marketplace page and the notice would render
 * unstyled on exactly the surface that most needs it to be read. The two are
 * kept in step by the words below, not by a shared module.
 *
 * WHY IT EXISTS. `data/dining.ts` attaches invented outlets, invented dishes
 * and invented francs to NAMED REAL HOTELS — the Kigali Serena, the Mille
 * Collines, the Radisson Blu. `data/properties.ts` refuses to fabricate reviews
 * or host profiles for a named business for exactly that reason; the dining
 * catalogue crosses that line on purpose, because the rule it demonstrates ("a
 * product tied to a hotel shows to that hotel's guests") is untestable without
 * a real property slug. The safeguard therefore moves to the surface: nobody
 * reads one of these menus without also reading that the hotel did not write it.
 *
 * WHY IT IS QUIET RATHER THAN AN ALARM. It appears on every property that sells
 * food and on every menu page under one, so it is read many times in a single
 * walkthrough. A red banner repeated that often is read once and then skipped,
 * and it also makes a working demonstration look broken to the audience it is
 * being shown to. A dashed rule in the secondary surface role stays legible
 * without pretending something has gone wrong.
 *
 * The literal words "Demo data" are load-bearing — contract C31 is observed by
 * a check that greps for them — so do not reword the label. `detail` is where a
 * screen says which of its own numbers are invented.
 */
export function DemoDataNotice({ detail }: { detail: string }) {
  return (
    <aside
      className="flex items-start gap-3 rounded-card border border-dashed border-input bg-secondary px-4 py-3"
      aria-label="Demo data notice"
    >
      <Info
        className="mt-0.5 size-4 shrink-0 text-page-fg-70"
        strokeWidth={1.8}
        aria-hidden
      />
      <p className="text-xs leading-relaxed text-page-fg-70">
        <span className="font-semibold text-page-fg">Demo data.</span> {detail}
      </p>
    </aside>
  );
}

/**
 * The one sentence used wherever a bar or restaurant price is on a public page.
 *
 * Declared once so the property page and the menu page under it cannot come to
 * describe the same fabrication in two different ways — the failure mode where
 * one screen says "prices are indicative" and the next says "prices are
 * invented", and a reader concludes that only the second one meant it.
 */
export const PROPERTY_DINING_DEMO_DETAIL =
  "The outlets, dishes and prices shown here were written for this " +
  "demonstration. They did not come from the hotel and are not what it charges.";
