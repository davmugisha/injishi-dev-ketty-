import type { SigningContext } from '../../../../modules/rentals/application/lease-signing.service';

/** The slice of the Fastify request a signature's evidence is read from. */
export interface SigningRequest {
  /** Resolved through `TRUST_PROXY`, as every throttle reads it. */
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

/** Where a signature was given from: the address and the browser, as the request shows them. */
export function signingContext(request: SigningRequest): SigningContext {
  const agent = request.headers['user-agent'];
  return {
    ip: request.ip && request.ip.length > 0 ? request.ip : null,
    userAgent: (Array.isArray(agent) ? agent[0] : agent) ?? null,
  };
}
