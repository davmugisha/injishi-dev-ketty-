import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { apiEnvFile, parseEnvText, scriptEnv } from './env-file.mjs';

test('a script reads the local test stack unless APP_ENV says otherwise', () => {
  assert.equal(scriptEnv({}), 'test');
  assert.equal(scriptEnv({ NODE_ENV: 'development' }), 'test');
  assert.equal(scriptEnv({ APP_ENV: 'development' }), 'development');
  assert.throws(() => scriptEnv({ APP_ENV: 'staging' }), /development, test, production/);
});

test("only the environment's own file is read, and the legacy .env only without one", () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'env-file-'));
  assert.equal(apiEnvFile({}, dir), null);
  writeFileSync(path.join(dir, '.env'), 'DATABASE_URL=legacy\n');
  assert.equal(apiEnvFile({}, dir), path.join(dir, '.env'));
  writeFileSync(path.join(dir, '.env.test'), 'DATABASE_URL=test\n');
  writeFileSync(path.join(dir, '.env.development'), 'DATABASE_URL=dev\n');
  assert.equal(apiEnvFile({}, dir), path.join(dir, '.env.test'));
  assert.equal(apiEnvFile({ APP_ENV: 'development' }, dir), path.join(dir, '.env.development'));
});

test('the parser reads KEY=VALUE, quotes, export and trailing comments', () => {
  assert.deepEqual(
    parseEnvText('# a comment\nexport A=1\nB="two words"\nC=3 # note\nD=postgres://u:p@h:1/db?x=y\n\nnot a line'),
    { A: '1', B: 'two words', C: '3', D: 'postgres://u:p@h:1/db?x=y' },
  );
});
