/**
 * `directory/[unitId]` — the Residence unit detail (frame B22).
 *
 * The one Residence unit screen in the app. `listing/[id]` redirects here for a
 * Residence id, so an older link still resolves and there is no second copy of
 * this page to keep in step.
 */
import { useLocalSearchParams } from 'expo-router';
import { UnitDetail } from '@/screens/broker/unit-detail';

export default function DirectoryUnitScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  return <UnitDetail id={unitId} />;
}
