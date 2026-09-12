/**
 * Inspection - frame W5, the supervisor's queue. Where inspection is required,
 * `done` is not sellable; only `inspected` is (F-P04 §9).
 */
import { Inspection } from '@/screens/work';

export default function InspectionScreen() {
  return <Inspection />;
}
