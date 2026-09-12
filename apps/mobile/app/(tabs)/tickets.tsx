/**
 * `/tickets` — the Engineering board from the reporter's side (F-P05). Frame
 * W6 is what fills it; until then it says "Nothing broken", which on a good
 * shift is the truth rather than an absence.
 */
import { TicketsBoard } from '@/screens/work';

export default function TicketsScreen() {
  return <TicketsBoard />;
}
