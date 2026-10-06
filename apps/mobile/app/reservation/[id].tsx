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
 * Registered in `app/_layout.tsx` as a card, with `reservation/[id]/check-in`,
 * inside a `Stack.Protected` that opens only for the host seat: a deep link
 * from any other seat is refused before this screen reads anything (mobile
 * audit 2026-10-05, HO-14 and HO-15).
 */
import { useLocalSearchParams } from 'expo-router';
import { HostBookingDetail } from '@/screens/host';

export default function ReservationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HostBookingDetail id={id} />;
}
