#!/usr/bin/env node
// Run the rent cycle's jobs once, now, against DATABASE_URL (rentals WP 1.6):
//
//   node scripts/run-rent-jobs.mjs cycle [yyyy-mm-dd]     raise rent due within 7 days of that day
//                                                         (today in Kigali when left out), start signed
//                                                         leases, move leases to ending, flag those past end
//   node scripts/run-rent-jobs.mjs reminders [iso moment] send the reminders due at that moment
//                                                         (now when left out; only 08:00 to 18:00 Kigali)
//   node scripts/run-rent-jobs.mjs settle                 look at every pending gateway payment
//   node scripts/run-rent-jobs.mjs payouts                release held payouts, resend lost ones
//
// The worker runs the same jobs on a schedule, and every step is idempotent,
// so running one by hand changes nothing a scheduled run would not. The day
// or moment is a PARAMETER of the run, never a change to the database's data.
//
// It boots the application context from a BUILD (`dist/`, or API_DIST_DIR),
// as the HTTP process, never as a worker: a worker would also start consuming
// every queue on the Redis it is pointed at.
//
//   pnpm -F @injishi/api build
//   DATABASE_URL=postgres://... node scripts/run-rent-jobs.mjs cycle 2026-10-29
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.INJISHI_PROCESS === 'worker' || process.argv.includes('--worker')) {
  console.error('Refusing to run as a worker: this boots the application context once and exits.');
  process.exit(1);
}

const [, , job, when] = process.argv;
if (!['cycle', 'reminders', 'settle', 'payouts'].includes(job ?? '')) {
  console.error('Usage: node scripts/run-rent-jobs.mjs <cycle|reminders|settle|payouts> [day or moment]');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', process.env.API_DIST_DIR || 'dist');

require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require(resolve(dist, 'app.module.js'));
const { RentCycleService } = require(resolve(dist, 'modules/rentals/application/rent-cycle.service.js'));
const { RentRemindersService } = require(resolve(dist, 'modules/rentals/application/rent-reminders.service.js'));
const { PaymentSettlementService } = require(resolve(dist, 'modules/rentals/application/payment-settlement.service.js'));
const { PayoutsService } = require(resolve(dist, 'modules/rentals/application/payouts.service.js'));

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
try {
  let outcome;
  if (job === 'cycle') outcome = await app.get(RentCycleService).run(when);
  else if (job === 'reminders') outcome = await app.get(RentRemindersService).run(when ? new Date(when) : undefined);
  else if (job === 'settle') outcome = await app.get(PaymentSettlementService).sweep();
  else outcome = await app.get(PayoutsService).sweep();
  console.log(JSON.stringify(outcome));
} finally {
  await app.close();
}
