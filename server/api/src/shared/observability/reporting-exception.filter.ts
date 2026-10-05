import { Catch, HttpException, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { reportException } from './error-reporter';

/**
 * The two things a report reads from a Fastify request. Structural rather than
 * `FastifyRequest`, so this file needs nothing but the fields it uses, and so
 * it cannot reach for the body, the query or a header by accident.
 */
interface RoutedRequest {
  method: string;
  routeOptions?: { url?: string };
}

/**
 * Whether an exception thrown in a request is a fault worth a report
 * (ADR-063 AC-12): anything that is not an `HttpException`, or one whose
 * status is exactly 500. A 4xx is an answer. So is a deliberate 501 to 599:
 * `ServiceUnavailableException` and its kind are things the code says on
 * purpose, and reporting them would bury the faults.
 */
export function isReportable(exception: unknown): boolean {
  if (exception instanceof HttpException) return exception.getStatus() === 500;
  return true;
}

/**
 * Every exception in an HTTP request passes here (registered with
 * `APP_FILTER`), is reported if it is a fault, and is then answered exactly as
 * Nest's own handler would answer it: this extends `BaseExceptionFilter` and
 * hands every exception to it unchanged.
 *
 * The route is Fastify's pattern (`/api/v1/leases/:id`), never `request.url`:
 * a path holds ids and a query string, and a pattern groups every lease's
 * failure into one issue. A request no route matched reports `unmatched`.
 *
 * The report runs inside a try, so it can never change the response.
 */
@Catch()
export class ReportingExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    try {
      if (host.getType() === 'http' && isReportable(exception)) {
        const request = host.switchToHttp().getRequest<RoutedRequest>();
        reportException(exception, {
          method: request.method,
          route: request.routeOptions?.url ?? 'unmatched',
          status: 500,
        });
      }
    } catch {
      // Answering the request matters more than reporting it.
    }
    super.catch(exception, host);
  }
}
