#!/usr/bin/env node
/**
 * Issue a claim invitation to every OBO registration that predates them
 * (ADR-053, AC-R1). Run once at the deploy that ships the owner claim.
 *
 * Invitations are written only by the create transaction, so a business
 * registered on behalf of its owner BEFORE that transaction wrote one has no
 * invitation and no way to be claimed. This finds each `obo_registrations` row
 * still `registrant_held` with no `claim_invitation_id`, writes an invitation
 * with the same 7 day expiry, links it, and mails it.
 *
 * IDEMPOTENT BY ITS OWN CONDITION. A row is taken only while its
 * `claim_invitation_id` is null, and it is set in the same transaction that
 * writes the invitation, under a row lock. Running it twice, or twice at once,
 * mails nobody twice.
 *
 * The token, the expiry, the link and the mail come from
 * `src/modules/organization/domain/owner-claim.ts`, the file the API itself
 * uses, so an invitation issued here is indistinguishable from one issued at
 * registration. A registration that recorded no owner email is skipped and
 * reported: there is nowhere to send one.
 *
 * Environment, read from the process and then from server/api/.env:
 *   DATABASE_URL   the database to write
 *   WEB_URL        web's public origin, required when NODE_ENV=production
 *   SMTP_URL       the relay; without it invitations are written and NOT mailed
 *   MAIL_FROM      the sender, defaulting as the API does
 *
 *   node scripts/issue-obo-claim-invitations.mjs            # issue and mail
 *   node scripts/issue-obo-claim-invitations.mjs --dry-run  # report only
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import nodemailer from 'nodemailer';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_MAIL_FROM = 'Injishi <no-reply@injishi.com>';

/** A value from the environment, else from server/api/.env, else undefined. */
function setting(name) {
  if (process.env[name] !== undefined) return process.env[name];
  const envFile = path.join(here, '..', '.env');
  if (!existsSync(envFile)) return undefined;
  const line = readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : undefined;
}

/**
 * The shared domain module: the TypeScript source under Node's type stripping
 * on a laptop, the compiled copy where only `dist/` is trusted.
 */
async function loadOwnerClaim() {
  const source = path.join(here, '..', 'src', 'modules', 'organization', 'domain', 'owner-claim.ts');
  const compiled = path.join(here, '..', 'dist', 'modules', 'organization', 'domain', 'owner-claim.js');
  if (existsSync(source)) {
    try {
      return await import(pathToFileURL(source).href);
    } catch (error) {
      if (!existsSync(compiled)) throw error;
    }
  }
  return createRequire(import.meta.url)(compiled);
}

/** The API's own rule (`shared/config/web-url.ts`), restated for a script. */
function webUrl() {
  const raw = setting('WEB_URL')?.trim();
  const production = setting('NODE_ENV') === 'production';
  if (!raw) {
    if (production) {
      throw new Error('WEB_URL is required when NODE_ENV=production: the invitation links to a page on web.');
    }
    return 'http://localhost:3000';
  }
  const url = new URL(raw);
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('WEB_URL must be an origin with no path, query or fragment.');
  }
  return url.origin;
}

async function main() {
  const claim = await loadOwnerClaim();
  const origin = webUrl();
  const databaseUrl = setting('DATABASE_URL');
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.');

  const smtpUrl = setting('SMTP_URL')?.trim();
  const from = setting('MAIL_FROM')?.trim() || DEFAULT_MAIL_FROM;
  const transport = smtpUrl ? nodemailer.createTransport(smtpUrl) : null;
  if (!transport) {
    console.warn('SMTP_URL is unset: invitations will be written but NOT mailed.');
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const counts = { issued: 0, mailed: 0, mailFailed: 0, noEmail: 0 };

  try {
    const { rows: noEmail } = await pool.query(
      `select org_id from obo_registrations
        where claim_status = 'registrant_held'
          and claim_invitation_id is null
          and intended_owner_email is null`,
    );
    counts.noEmail = noEmail.length;
    for (const row of noEmail) {
      console.warn(`  skipped org ${row.org_id}: no owner email recorded, nowhere to send an invitation`);
    }

    for (;;) {
      const client = await pool.connect();
      let issued = null;
      try {
        await client.query('begin');
        // One row at a time, locked and re-checked, so a concurrent run takes a
        // different row or none. `skip locked` keeps two runs from queueing.
        const { rows } = await client.query(
          `select o.id, o.org_id, o.intended_owner_email, o.intended_owner_name,
                  o.registrant_user_id, g.legal_name,
                  coalesce(nullif(trim(v.legal_full_name), ''), nullif(trim(u.name), '')) as registrant_name
             from obo_registrations o
             join orgs g on g.id = o.org_id
             left join verified_identities v on v.user_id = o.registrant_user_id
             left join users u on u.id = o.registrant_user_id
            where o.claim_status = 'registrant_held'
              and o.claim_invitation_id is null
              and o.intended_owner_email is not null
            order by o.created_at
            limit 1
              for update of o skip locked`,
        );
        const obo = rows[0];
        if (!obo) {
          await client.query('rollback');
          break;
        }

        if (DRY_RUN) {
          console.log(`  would issue: org ${obo.org_id} (${obo.legal_name}) to ${obo.intended_owner_email}`);
          await client.query('rollback');
          counts.issued += 1;
          // A dry run cannot mark rows, so it reports everything in one pass. On the
          // connection this loop already holds: the pool has exactly one, so asking
          // the pool for another here waits forever.
          const { rows: rest } = await client.query(
            `select o.org_id, o.intended_owner_email, g.legal_name
               from obo_registrations o join orgs g on g.id = o.org_id
              where o.claim_status = 'registrant_held'
                and o.claim_invitation_id is null
                and o.intended_owner_email is not null
                and o.id <> $1`,
            [obo.id],
          );
          for (const r of rest) {
            console.log(`  would issue: org ${r.org_id} (${r.legal_name}) to ${r.intended_owner_email}`);
            counts.issued += 1;
          }
          break;
        }

        const token = claim.newClaimToken();
        const expiresAt = claim.claimInvitationExpiresAt(new Date());
        const { rows: inserted } = await client.query(
          `insert into org_invitations (org_id, email, org_role, purpose, token, status, expires_at)
           values ($1, $2, 'owner', 'obo_claim', $3, 'sent', $4)
           returning id`,
          [obo.org_id, obo.intended_owner_email, token, expiresAt],
        );
        await client.query(
          `update obo_registrations set claim_invitation_id = $1, updated_at = now() where id = $2`,
          [inserted[0].id, obo.id],
        );
        await client.query('commit');
        counts.issued += 1;
        issued = { obo, token, expiresAt };
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally {
        client.release();
      }

      // Mailed after the commit, as the API does: a failed send leaves the
      // invitation standing rather than rolling it back.
      const { obo, token, expiresAt } = issued;
      if (!transport) continue;
      const mail = claim.claimInvitationMail({
        legalName: obo.legal_name,
        intendedOwnerName: obo.intended_owner_name,
        registrantName: obo.registrant_name ?? null,
        link: claim.claimLink(origin, obo.org_id, token),
        expiresAt,
      });
      try {
        await transport.sendMail({ from, to: obo.intended_owner_email, ...mail });
        counts.mailed += 1;
        console.log(`  issued and mailed: org ${obo.org_id} to ${obo.intended_owner_email}`);
      } catch (error) {
        counts.mailFailed += 1;
        console.error(`  issued, NOT mailed: org ${obo.org_id}: ${error instanceof Error ? error.message : error}`);
      }
    }
  } finally {
    await pool.end();
    transport?.close();
  }

  const verb = DRY_RUN ? 'would issue' : 'issued';
  console.log(
    `\n${verb} ${counts.issued}, mailed ${counts.mailed}, mail failed ${counts.mailFailed}, skipped for no email ${counts.noEmail}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
