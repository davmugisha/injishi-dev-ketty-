import { describe, expect, it } from 'vitest';

import path from 'node:path';

import { appEnv, envFileName, envFilesFor } from './env-files';

describe('appEnv', () => {
  it('follows APP_ENV when it is set', () => {
    expect(appEnv({ APP_ENV: 'test', NODE_ENV: 'development' })).toBe('test');
    expect(appEnv({ APP_ENV: 'production' })).toBe('production');
    expect(appEnv({ APP_ENV: ' development ' })).toBe('development');
  });

  it('refuses an APP_ENV it does not know, naming the three it does', () => {
    expect(() => appEnv({ APP_ENV: 'staging' })).toThrow(/development, test, production/);
  });

  it('follows NODE_ENV when APP_ENV is unset, and is development otherwise', () => {
    expect(appEnv({ NODE_ENV: 'test' })).toBe('test');
    expect(appEnv({ NODE_ENV: 'production' })).toBe('production');
    expect(appEnv({ NODE_ENV: 'development' })).toBe('development');
    expect(appEnv({})).toBe('development');
    expect(appEnv({ APP_ENV: '' })).toBe('development');
  });
});

describe('envFilesFor', () => {
  const dir = '/repo/server/api';
  const only = (...names: string[]) => (file: string) => names.map((n) => path.join(dir, n)).includes(file);

  it("reads only the environment's own file, never another one under it", () => {
    expect(envFilesFor(dir, { APP_ENV: 'test' }, only('.env.test', '.env', '.env.development'))).toEqual([
      path.join(dir, '.env.test'),
    ]);
  });

  it('falls back to the legacy .env when the environment has no file', () => {
    expect(envFilesFor(dir, {}, only('.env'))).toEqual([path.join(dir, '.env')]);
  });

  it('reads nothing when there is no file at all, as in a container', () => {
    expect(envFilesFor(dir, { NODE_ENV: 'production' }, only())).toEqual([]);
  });

  it('names the file after the environment', () => {
    expect(envFileName('development')).toBe('.env.development');
  });
});
