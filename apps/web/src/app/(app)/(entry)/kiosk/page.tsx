/**
 * /kiosk (ADR-058, 058-time AC-TM10): the attendance tablet at a staff door.
 *
 * The screen is a Client Component (`attendance-kiosk.tsx`), and its parts sit
 * beside this file rather than under `src/components/` on purpose: the app
 * sheet's Tailwind scan reaches `./(app)` and a named list of component
 * folders, and a kiosk folder there would compile to unstyled markup.
 *
 * It stays out of `PROTECTED_PREFIXES`: nobody signs in on a kiosk, and a
 * gate here would send the tablet to a sign-in screen it must never use.
 */
import { AttendanceKiosk } from "./attendance-kiosk";

export default function Page() {
  return <AttendanceKiosk />;
}
