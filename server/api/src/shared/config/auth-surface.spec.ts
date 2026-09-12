import {
  assertSurfaceSecretsDiffer,
  hostFromHeaders,
  normaliseHost,
  resolveAuthSurface,
  resolveOversightHosts,
} from './auth-surface';

/**
 * The session boundary between the marketplace and the government console
 * (ADR-018, AC-5, D-i, D-o).
 *
 * These are pinned because every failure here is SILENT. A surface that
 * resolves the wrong way, or two secrets that happen to match, break nothing a
 * person could see: every screen renders, every queue fills, and an operator's
 * own session opens the console that reviews them.
 */
describe('auth surface resolution', () => {
  describe('host parsing', () => {
    it('strips the port and lowercases', () => {
      expect(normaliseHost('Oversight.Injishi.RW:8080')).toBe(
        'oversight.injishi.rw',
      );
    });

    it('keeps an IPv6 literal intact', () => {
      expect(normaliseHost('[::1]:3000')).toBe('[::1]');
    });

    it('reads the host header in either form', () => {
      expect(hostFromHeaders({ host: 'a.example.com' })).toBe('a.example.com');
      expect(hostFromHeaders({ host: ['b.example.com'] })).toBe(
        'b.example.com',
      );
      expect(hostFromHeaders(undefined)).toBe('');
    });
  });

  describe('resolveOversightHosts', () => {
    it('has no default — an unconfigured console is unreachable', () => {
      expect(resolveOversightHosts({})).toEqual([]);
      expect(resolveOversightHosts({ oversightHostnames: '' })).toEqual([]);
    });

    it('reads a comma separated list, normalised', () => {
      expect(
        resolveOversightHosts({
          oversightHostnames: 'Oversight.Injishi.RW:443, api.oversight.injishi.rw',
        }),
      ).toEqual(['oversight.injishi.rw', 'api.oversight.injishi.rw']);
    });
  });

  describe('resolveAuthSurface', () => {
    const hosts = ['oversight.injishi.rw'];

    it('resolves a listed host to the console', () => {
      expect(resolveAuthSurface('oversight.injishi.rw', hosts)).toBe('oversight');
    });

    it('ignores the port, so :443 and :8000 match the same host', () => {
      expect(resolveAuthSurface('oversight.injishi.rw:443', hosts)).toBe(
        'oversight',
      );
    });

    it('resolves every other host to the marketplace, unchanged', () => {
      expect(resolveAuthSurface('injishi.rw', hosts)).toBe('marketplace');
      expect(resolveAuthSurface('pms.injishi.rw', hosts)).toBe('marketplace');
      expect(resolveAuthSurface(undefined, hosts)).toBe('marketplace');
    });

    it('never invents a console when none is configured', () => {
      expect(resolveAuthSurface('oversight.injishi.rw', [])).toBe('marketplace');
    });

    /**
     * The near miss. `injishi.rw.evil.com` ENDS WITH nothing useful and
     * `oversight.injishi.rw.evil.com` merely contains the real host, so an
     * implementation matching by suffix or substring would hand an attacker a
     * console instance. Exact match only.
     */
    it('refuses a host that only looks like the console host', () => {
      expect(resolveAuthSurface('oversight.injishi.rw.evil.com', hosts)).toBe(
        'marketplace',
      );
      expect(resolveAuthSurface('evil-oversight.injishi.rw', hosts)).toBe(
        'marketplace',
      );
    });
  });

  describe('assertSurfaceSecretsDiffer', () => {
    it('passes when the two surfaces sign with different secrets', () => {
      expect(() =>
        assertSurfaceSecretsDiffer('marketplace-secret', 'console-secret'),
      ).not.toThrow();
    });

    it('refuses to boot when the secrets match', () => {
      expect(() =>
        assertSurfaceSecretsDiffer('same-secret', 'same-secret'),
      ).toThrow(/must differ/i);
    });

    it('refuses a copy that differs only by whitespace', () => {
      expect(() =>
        assertSurfaceSecretsDiffer('same-secret', '  same-secret\n'),
      ).toThrow(/must differ/i);
    });
  });
});
