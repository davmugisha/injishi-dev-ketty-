import type { ConfigService } from '@nestjs/config';

import { readTrainingConfig } from './training-config';

/**
 * Where a certificate's QR and verify link point (demo-comms, 2026-09-14).
 *
 * The deployed API and worker are given `WEB_URL`, not the frontend's
 * `NEXT_PUBLIC_WEB_URL`, so reading only the latter sent demo links to
 * localhost.
 */
function configOf(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('readTrainingConfig · verifyBaseUrl', () => {
  it('prefers the explicit TRAINING_VERIFY_BASE_URL', () => {
    const cfg = readTrainingConfig(
      configOf({
        TRAINING_VERIFY_BASE_URL: 'https://verify.example.com',
        WEB_URL: 'https://www-demo.injishi.com',
        NEXT_PUBLIC_WEB_URL: 'https://other.example.com',
      }),
    );
    expect(cfg.verifyBaseUrl).toBe('https://verify.example.com');
  });

  it('follows WEB_URL, which the deployed demo sets, before NEXT_PUBLIC_WEB_URL', () => {
    const cfg = readTrainingConfig(
      configOf({ WEB_URL: 'https://www-demo.injishi.com', NEXT_PUBLIC_WEB_URL: 'https://other.example.com' }),
    );
    expect(cfg.verifyBaseUrl).toBe('https://www-demo.injishi.com');
  });

  it('uses NEXT_PUBLIC_WEB_URL when WEB_URL is blank', () => {
    const cfg = readTrainingConfig(configOf({ WEB_URL: '  ', NEXT_PUBLIC_WEB_URL: 'https://other.example.com' }));
    expect(cfg.verifyBaseUrl).toBe('https://other.example.com');
  });

  it('falls back to the laptop origin only when nothing is set', () => {
    expect(readTrainingConfig(configOf({})).verifyBaseUrl).toBe('http://localhost:3000');
  });
});
