/**
 * `/reservation/[id]` — one booking, from the desk's side.
 *
 * A FLAT dynamic route beside its own folder, not an `index.tsx` inside it.
 * The generator collapses `[id]/index.tsx` to `/reservation/[id]` on a cold
 * scan and leaves it as `/reservation/[id]/index` on a warm one, so with three
 * sessions regenerating `.expo/types/router.d.ts` in one checkout the union
 * flipped between the two forms and typecheck failed on alternate runs. A flat
 * file has no `index` to collapse, so both forms are the same form.
 *
 * Not registered in `app/_layout.tsx`: that file is frozen until Session 11
 * (MOBILE-PROTOTYPE-PROMPTS.md Part 3), and Expo Router discovers a route from
 * the file system regardless — a `Stack.Screen` entry only sets OPTIONS. The
 * stack's `screenOptions` already hide the header and paint the app ground, so
 * this presents as a card like every other detail route. Session 11 should add
 * the two `reservation/` lines beside the rest for the sake of the table.
 */
import { useLocalSearchParams } from 'expo-router';
import { HostBookingDetail } from '@/screens/host';

export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HostBookingDetail id={id} />;
}
