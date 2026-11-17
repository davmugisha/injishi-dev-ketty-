import { Injectable, type ExecutionContext } from '@nestjs/common';
import {
  ThrottlerException,
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerOptions,
} from '@nestjs/throttler';

/**
 * Table QR ordering's own buckets (migration 0156). Nobody on it is signed in, so a bucket is the caller's address
 * AND the table's code: one busy table cannot use up another table's allowance, and one phone cannot flood a table.
 * Its own list rather than `ThrottlerModule.forRoot`, which is shared with every controller (see
 * PsfPublicThrottlerGuard). Counts live in process memory, like every throttler here.
 *
 * Behind a proxy the address is the proxy's unless TRUST_PROXY is set; the code still separates the tables.
 */
interface RawRequest {
  ip?: string;
  params?: Record<string, string | undefined>;
}
const trackerOf = (req: RawRequest): string => `ip:${req.ip || 'unknown'}:t:${(req.params?.code ?? '').slice(0, 64)}`;
const keyFor = (_context: ExecutionContext, tracker: string, name: string): string => `${name}:${tracker}`;

export const TABLE_ORDER_THROTTLERS: ThrottlerOptions[] = [
  // Reading the menu, a photo, or the order's progress (the confirmation polls every few seconds).
  { name: 'table-read', limit: 240, ttl: 60_000, getTracker: (req) => trackerOf(req), generateKey: keyFor },
  // Sending an order: far above a real table's rounds, far below a script's.
  { name: 'table-order', limit: 12, ttl: 10 * 60_000, getTracker: (req) => trackerOf(req), generateKey: keyFor },
];

@Injectable()
export class TableOrderThrottlerGuard extends ThrottlerGuard {
  override async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = TABLE_ORDER_THROTTLERS;
  }

  protected override async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const minutes = Math.max(1, Math.ceil(detail.timeToBlockExpire / 60));
    throw new ThrottlerException(
      `Too many tries from this table in a short time. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask a member of staff.`,
    );
  }
}
