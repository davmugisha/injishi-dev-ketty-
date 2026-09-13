import { NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import {
  PreLaunchGuard,
  isPreLaunchHost,
  normalizeHost,
} from './pre-launch.guard';

/**
 * The API half of waitlist mode has to be right the first time it runs.
 *
 * A cross-check of ADR-048 found that the web gate alone left the entire
 * fixture catalogue readable as JSON on `api.injishi.com`, so a wall the
 * website honoured and the API did not was not a wall. This guard closes that,
 * and like the web gate it is scoped by host, which means it NEVER RUNS on a
 * laptop, on staging or on the demo host. Nothing exercises it before the day
 * it matters, so it is covered here instead.
 *
 * Two ways to get it wrong, failing in opposite directions:
 *
 * - TOO NARROW and the catalogue stays open on production while everyone
 *   believes it is closed. That is the hole this guard was written to fix.
 * - TOO WIDE and `GET /properties/:id` answers 404 on a laptop, which breaks
 *   local development of the property and booking flows for everybody (AC-24).
 */

function contextWithHost(host?: string | string[]): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: host === undefined ? {} : { host } }),
    }),
  } as unknown as ExecutionContext;
}

describe('normalizeHost', () => {
  it.each([
    ['api.injishi.com', 'api.injishi.com'],
    ['API.Injishi.com', 'api.injishi.com'],
    ['API.INJISHI.COM', 'api.injishi.com'],
    ['api.injishi.com:443', 'api.injishi.com'],
    ['  api.injishi.com  ', 'api.injishi.com'],
    ['localhost:8000', 'localhost'],
    // An IPv6 literal keeps its brackets and its own colons. A naive
    // `split(':')[0]` returns '[', which matches nothing.
    ['[::1]:8000', '[::1]'],
    ['[::1]', '[::1]'],
    [undefined, ''],
    ['', ''],
  ])('normalizes %p to %p', (raw, expected) => {
    expect(normalizeHost(raw)).toBe(expected);
  });
});

describe('isPreLaunchHost closes the production API', () => {
  it.each([
    'api.injishi.com',
    'API.Injishi.com',
    'api.injishi.com:443',
    '  api.injishi.com  ',
  ])('%s is a pre-launch host', (host) => {
    expect(isPreLaunchHost(host)).toBe(true);
  });
});

describe('isPreLaunchHost leaves every other host alone (AC-24)', () => {
  it.each([
    'localhost:8000',
    '127.0.0.1:8000',
    '[::1]:8000',
    'api.staging.injishi.rw',
    'api.demo.injishi.rw',
    // The suffix and prefix tricks. A guard written with `endsWith` or
    // `startsWith` would treat an attacker-controlled host as production, and
    // one written that way in the other direction would close a local machine.
    'api.injishi.com.evil.com',
    'evil.api.injishi.com',
    'www.injishi.com',
    '',
  ])('%s answers normally', (host) => {
    expect(isPreLaunchHost(host)).toBe(false);
  });
});

describe('PreLaunchGuard', () => {
  const guard = new PreLaunchGuard();

  it('refuses with 404 and not 403 on a pre-launch host', () => {
    // Not a 403: a 403 confirms the resource exists, which is the one fact
    // this guard withholds. To a stranger the route simply is not there yet.
    expect(() => guard.canActivate(contextWithHost('api.injishi.com'))).toThrow(
      NotFoundException,
    );
  });

  it('passes a local request straight through', () => {
    expect(guard.canActivate(contextWithHost('localhost:8000'))).toBe(true);
  });

  it('passes a request carrying no host header', () => {
    // An absent host is not a match, so it is not gated. Deployed, Traefik
    // routes by host and a request that reached the API had one.
    expect(guard.canActivate(contextWithHost())).toBe(true);
  });

  it('reads the first value when the header arrived more than once', () => {
    expect(() =>
      guard.canActivate(contextWithHost(['api.injishi.com', 'localhost'])),
    ).toThrow(NotFoundException);
  });
});
