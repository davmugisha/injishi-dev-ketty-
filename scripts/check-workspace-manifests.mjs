#!/usr/bin/env node
/**
 * Fail when a workspace member declares no `typecheck`, `lint` or `test`.
 *
 * ADR-052 AC-2b. This exists because of HOW `pnpm -r` fails: a member with no
 * script is SKIPPED, in silence, with a zero exit code. Four members were being
 * skipped that way when this was written, which is what made "the run is green"
 * mean less than it looked like. Closing that hole once is not enough, because
 * the next package added under `packages/*` reopens it the same silent way. So
 * the hole is closed by a check rather than by a fix.
 *
 * The member list comes from `scripts/workspace-members.mjs`, which reads the
 * globs out of `pnpm-workspace.yaml`, so a new glob is covered without editing
 * this file.
 *
 * Usage:  node scripts/check-workspace-manifests.mjs
 * Exits 0 when every member declares all three, 1 otherwise, naming each gap.
 */
import { workspaceMembers } from './workspace-members.mjs';

const REQUIRED = ['typecheck', 'lint', 'test'];

const members = workspaceMembers();

const rows = members.map((member) => ({
  ...member,
  missing: REQUIRED.filter(
    (script) => typeof member.scripts[script] !== 'string' || member.scripts[script].trim() === '',
  ),
}));

const width = Math.max(...rows.map((row) => row.name.length));
for (const row of rows) {
  const mark = row.missing.length === 0 ? 'ok  ' : 'FAIL';
  const detail = row.missing.length === 0 ? '' : `  missing: ${row.missing.join(', ')}`;
  console.log(`${mark} ${row.name.padEnd(width)}  ${row.dir}${detail}`);
}

console.log('');
console.log(`${members.length} workspace members checked for: ${REQUIRED.join(', ')}`);

const failures = rows.filter((row) => row.missing.length > 0);
if (failures.length > 0) {
  console.error('');
  console.error(`${failures.length} workspace member(s) lack a script, which \`pnpm -r\` would skip in silence:`);
  for (const failure of failures) {
    console.error(`  ${failure.name} (${failure.dir}) is missing: ${failure.missing.join(', ')}`);
  }
  console.error('');
  console.error('Add the missing script. A package with no tests declares');
  console.error('  "test": "node ../../scripts/no-tests.mjs"');
  console.error('which states the absence out loud instead of being passed over (ADR-052 AC-2b).');
  process.exit(1);
}
