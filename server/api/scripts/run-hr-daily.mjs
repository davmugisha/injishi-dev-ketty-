#!/usr/bin/env node
// Run the HR daily job once, now (ADR-058): contract statuses, leave accruals,
// document expiry reminders and rotation shifts, against DATABASE_URL. With
// --sweep, run the 15 minute attendance sweep once instead (058-time AC-TM4).
//
// The worker runs the same job at 00:15 Kigali every day, and every step of it
// is idempotent, so running it by hand changes nothing a scheduled run would
// not. It exists for the first run after downtime, and for the verify scripts:
// "the next daily run raises one reminder" (058-people-file AC-PF5) can only be
// proved by running the daily job.
//
// It boots the application context from a BUILD (`dist/`, or API_DIST_DIR), as
// the HTTP process, never as a worker: a worker would also start consuming every
// queue on the Redis it is pointed at.
//
//   pnpm -F @injishi/api build
//   DATABASE_URL=postgres://.../injishi_sample node scripts/run-hr-daily.mjs [--sweep]
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.INJISHI_PROCESS === 'worker' || process.argv.includes('--worker')) {
  console.error('Refusing to run as a worker: this boots the application context once and exits.');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', process.env.API_DIST_DIR || 'dist');

require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require(resolve(dist, 'app.module.js'));
const { HrDailyService } = require(resolve(dist, 'modules/hr/application/hr-daily.service.js'));
const { AttendanceSweepService } = require(resolve(dist, 'modules/hr/application/attendance-sweep.service.js'));

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
try {
  const outcome = process.argv.includes('--sweep')
    ? await app.get(AttendanceSweepService).run()
    : await app.get(HrDailyService).run();
  console.log(JSON.stringify(outcome));
} finally {
  await app.close();
}
