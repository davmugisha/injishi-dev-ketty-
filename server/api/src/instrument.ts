/**
 * Crash reporting, first (ADR-063).
 *
 * `main.ts` imports this before anything else, so the reporter is installed
 * before any module loads, in both the HTTP and the worker process, and a fault
 * while one loads, an unhandled rejection or an uncaught exception is reported.
 * `initErrorReporter` never throws, and is inert wherever this process must not
 * report (no DSN, staging, a laptop).
 */
import { initErrorReporter } from './shared/observability/error-reporter';

initErrorReporter();
