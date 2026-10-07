import type { BulkResponse } from '@injishi/contracts';
import { HttpException, Logger } from '@nestjs/common';

const logger = new Logger('BulkAction');

/**
 * Run a bulk action as the single row command, once per id (AC-LF6).
 *
 * There is deliberately no set based path: each id goes through the same
 * service method a one row click calls, with its permission, branch and state
 * checks, its own transaction and its own audit row. A refusal for one id is
 * reported in that id's result in the command's own words and never undoes the
 * ids already done. Ids run one after another, so two rows of one person never
 * contend for that person's lock.
 */
export async function runBulk(
  ids: readonly string[],
  run: (id: string) => Promise<unknown>,
): Promise<BulkResponse> {
  const results: BulkResponse['results'] = [];
  for (const id of [...new Set(ids)]) {
    try {
      await run(id);
      results.push({ id, ok: true });
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse();
        const message =
          typeof body === 'string' ? body : (body as { message?: unknown }).message ?? error.message;
        results.push({
          id,
          ok: false,
          status: error.getStatus(),
          error: Array.isArray(message) ? message.join(' ') : String(message),
        });
      } else {
        // Not a refusal: a fault. Report it on the row and log it, so the ids
        // after it still run and the caller sees which one failed.
        logger.error(`Bulk action failed on ${id}: ${(error as Error).message}`, (error as Error).stack);
        results.push({ id, ok: false, status: 500, error: 'Something went wrong with this one.' });
      }
    }
  }
  return { results };
}
