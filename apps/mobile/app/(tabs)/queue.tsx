/**
 * `/queue` — the Work home (frames W1, W2, W8). Unlinked because `index`
 * renders it for the work surface; the file keeps the path resolving for a
 * deep link and for a `router.push` written against it.
 */
import { WorkQueue } from '@/screens/work';

export default function QueueScreen() {
  return <WorkQueue />;
}
