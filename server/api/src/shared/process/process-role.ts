/**
 * Which of the two processes this code is running in. One codebase boots as
 * either the HTTP/WS app (`AppModule.main`) or the BullMQ worker
 * (`AppModule.worker`) — see main.ts. BookingModule and every future queue
 * module reads this to register its processor only in the worker, so HTTP
 * request threads never do background job work.
 *
 * Which ENVIRONMENT a process serves is a separate question, answered once for
 * both kinds of process by `shared/config/platform.ts` (ADR-043).
 */
export function isWorkerProcess(): boolean {
  return (
    process.argv.includes('--worker') ||
    process.env.INJISHI_PROCESS === 'worker'
  );
}
