#!/usr/bin/env node
/**
 * A compensation job that spent its retries runs again (073-gtbank-payments
 * AC-25), against REAL BullMQ and Redis.
 *
 * Compensation jobs are kept when they fail (`removeOnFail: false`), and BullMQ
 * ignores an add under an id it still holds. So a refund whose job spent its
 * attempts sat in `failed` for ever while the drain "re-queued" it every
 * minute. This script builds that state on a scratch queue no worker reads,
 * runs the built `PaymentCompensationService.drain()` against it, and checks the
 * job is waiting again. It first proves the premise, that a plain add under
 * the spent id is ignored.
 *
 *   node scripts/verify-compensation-drain.mjs
 *
 * WHAT IT WRITES: one `payment_compensations` row on a sample database, and the
 * scratch queue; both are removed at the end. DATABASE_URL, REDIS_HOST and
 * REDIS_PORT default to ../.env. Prints `compensation drain verification
 * passed` only when every check holds.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { Queue, Worker, QueueEvents } = require('bullmq');

function fromEnvFile(name, fallback) {
  if (process.env[name]) return process.env[name];
  const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : fallback;
}

let pass = 0;
const failed = [];
function check(id, label, ok, detail = '') {
  if (ok) pass += 1;
  else failed.push(id);
  console.log(`  ${ok ? 'PASS' : 'FAIL'} [${id}] ${label}${!ok && detail ? `   -> ${detail}` : ''}`);
}

const connection = { host: fromEnvFile('REDIS_HOST', '127.0.0.1'), port: Number(fromEnvFile('REDIS_PORT', '6379')) };
const pool = new pg.Pool({ connectionString: fromEnvFile('DATABASE_URL'), max: 2 });
const queueName = `verify-drain-${randomUUID()}`;
const queue = new Queue(queueName, { connection });
const events = new QueueEvents(queueName, { connection });
const key = `refund:verify-drain:${randomUUID()}`;

const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('../dist/database/drizzle/schema.js');
const { queueJobId } = require('../dist/shared/queues/job-id.js');
const { PaymentCompensationService } = require('../dist/modules/payments/application/payment-compensation.service.js');

const jobId = queueJobId(key);
const data = { kind: 'refund', idempotencyKey: key, workspaceId: randomUUID(), originalRef: 'mock_verify', amountRwf: 1000, memo: 'verify drain' };

console.log(`Compensation drain against Redis ${connection.host}:${connection.port} (${new Date().toISOString()})\n`);
try {
  await events.waitUntilReady();
  const workspace = (await pool.query('SELECT id FROM workspaces LIMIT 1')).rows[0];
  data.workspaceId = workspace.id;

  // 1. A job that spends its only attempt, kept in `failed` as ours are.
  const worker = new Worker(
    queueName,
    async () => {
      throw new Error('the provider did not confirm');
    },
    { connection },
  );
  const spent = await queue.add('refund', data, { jobId, attempts: 1, removeOnComplete: false, removeOnFail: false });
  await spent.waitUntilFinished(events).catch(() => undefined);
  await worker.close();
  check('spent', 'the job spent its attempts and is kept as failed', (await (await queue.getJob(jobId))?.getState()) === 'failed');

  // 2. The premise: a plain add under the spent id is ignored by BullMQ.
  await queue.add('refund', data, { jobId, attempts: 10 });
  check('premise', 'BullMQ ignores an add under the id of a job it still holds', (await (await queue.getJob(jobId))?.getState()) === 'failed');

  // 3. The row says the money is still owed; the drain must run it again.
  await pool.query(
    `INSERT INTO payment_compensations (kind, idempotency_key, workspace_id, original_ref, amount_rwf, memo, next_at)
     VALUES ('refund', $1, $2, 'mock_verify', 1000, 'verify drain', now() - interval '1 minute')`,
    [key, data.workspaceId],
  );
  const service = new PaymentCompensationService(queue, drizzle(pool, { schema }));
  await service.drain(new Date(), 500);
  const after = await (await queue.getJob(jobId))?.getState();
  check('drained', 'the drain removed the spent job and queued it again: it is waiting', after === 'waiting', after);
} catch (error) {
  check('ran', 'the drain check ran', false, error?.message ?? String(error));
} finally {
  await pool.query('DELETE FROM payment_compensations WHERE idempotency_key = $1', [key]).catch(() => undefined);
  await queue.obliterate({ force: true }).catch(() => undefined);
  await events.close();
  await queue.close();
  await pool.end();
}

console.log(`\nRESULT pass=${pass} fail=${failed.length} failed=[${failed.join(',')}]`);
if (failed.length > 0) process.exit(1);
console.log('compensation drain verification passed');
