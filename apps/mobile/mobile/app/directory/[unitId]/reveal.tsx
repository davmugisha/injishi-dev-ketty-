/**
 * `directory/[unitId]/reveal` — frame B22's sheet.
 *
 * Registered in `app/_layout.tsx` as a quarter-height `formSheet` (decision
 * D8), so the presentation is the platform's; `UnitReveal` draws only what goes
 * inside it.
 *
 * Revealing marks a placement intent and spends a credit, which is why it is a
 * confirm step and not a tap.
 */
import { useLocalSearchParams } from 'expo-router';
import { UnitReveal } from '@/screens/broker/unit-reveal';

export default function DirectoryRevealScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  return <UnitReveal id={unitId} />;
}
