import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadEnvFiles } from './shared/config/env-files';

/**
 * The env file reaches `process.env` before any module loads (2026-10-24).
 *
 * `payments.module.ts` reads PAYMENT_ADAPTER_MODE while its `@Module` decorator
 * is evaluated, which is before `ConfigModule.forRoot` has read anything, so a
 * value kept only in `.env.test` was ignored. `main.ts` now imports
 * `load-env.ts` first.
 */

const PROBE = 'INJISHI_LOAD_ENV_PROBE';

describe('loadEnvFiles', () => {
  const files = {
    '/api/.env.test': 'A=from-file\nB=from-file\nC="quoted value"\n# a comment\nEMPTY=\n',
  };
  const read = (file: string): string => files[file as keyof typeof files];

  it('sets every key the file names that the process does not already have', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(loadEnvFiles(['/api/.env.test'], env, read)).toEqual(['/api/.env.test']);
    expect(env).toEqual({ A: 'from-file', B: 'from-file', C: 'quoted value', EMPTY: '' });
  });

  it('never overrides a variable the process already has, an empty one included', () => {
    const env: NodeJS.ProcessEnv = { A: 'from-docker', B: '' };
    loadEnvFiles(['/api/.env.test'], env, read);
    expect(env.A).toBe('from-docker');
    expect(env.B).toBe('');
    expect(env.C).toBe('quoted value');
  });

  it('reads nothing when there is no file, as in a container fed by its compose file', () => {
    const env: NodeJS.ProcessEnv = { A: 'x' };
    expect(loadEnvFiles([], env, read)).toEqual([]);
    expect(env).toEqual({ A: 'x' });
  });
});

describe('load-env.ts', () => {
  let dir: string;
  const saved = { APP_ENV: process.env.APP_ENV, PAYMENT_ADAPTER_MODE: process.env.PAYMENT_ADAPTER_MODE };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'injishi-load-env-'));
    writeFileSync(path.join(dir, '.env.test'), `${PROBE}=from-file\nPAYMENT_ADAPTER_MODE=off\n`);
    jest.spyOn(process, 'cwd').mockReturnValue(dir);
    process.env.APP_ENV = 'test';
    delete process.env[PROBE];
    delete process.env.PAYMENT_ADAPTER_MODE;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
    delete process.env[PROBE];
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("fills process.env from the file APP_ENV picks, the moment it is imported", () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh load is the thing under test
      require('./load-env');
    });
    expect(process.env[PROBE]).toBe('from-file');
    expect(process.env.PAYMENT_ADAPTER_MODE).toBe('off');
  });

  it('leaves a value the process was started with alone', () => {
    process.env.PAYMENT_ADAPTER_MODE = 'mock';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh load is the thing under test
      require('./load-env');
    });
    expect(process.env.PAYMENT_ADAPTER_MODE).toBe('mock');
  });

  it('is the first thing main.ts imports after reflect-metadata, ahead of AppModule', () => {
    const main = readFileSync(path.join(__dirname, 'main.ts'), 'utf8');
    const imports = [...main.matchAll(/^import\s+(?:[^'"]*from\s+)?'([^']+)';/gm)].map((m) => m[1]);
    expect(imports.slice(0, 2)).toEqual(['reflect-metadata', './load-env']);
    expect(imports.indexOf('./load-env')).toBeLessThan(imports.indexOf('./app.module'));
  });
});
