/**
 * The one enumeration of this workspace's members.
 *
 * Two ADR-048 checks depend on knowing every member: the manifest meta check
 * (AC-2b) and the lint ratchet (AC-3). Both would be wrong in the same
 * direction if they carried their own list and it went stale, so they share
 * this one, and this one reads `pnpm-workspace.yaml` rather than restating it.
 *
 * The workspace ROOT is not a member. It is what runs `pnpm -r`, not something
 * `pnpm -r` reaches.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Read the `packages:` list out of pnpm-workspace.yaml.
 *
 * Deliberately not a YAML parser. The file is a comment block and a flat list
 * of strings, and taking a dependency to read three lines would put a package
 * between the repository and the checks that guard it.
 */
function readWorkspaceGlobs() {
  const file = join(REPO_ROOT, 'pnpm-workspace.yaml');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === 'packages:');
  if (start === -1) throw new Error(`${file}: no \`packages:\` key`);

  const globs = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const match = /^\s+-\s+['"]?([^'"#\s]+)['"]?\s*$/.exec(line);
    if (!match) break; // the list ended and the next key began
    globs.push(match[1]);
  }
  if (globs.length === 0) throw new Error(`${file}: \`packages:\` is empty`);
  return globs;
}

/** Expand `apps/*` to each directory under it. A literal path expands to itself. */
function expand(glob) {
  if (!glob.includes('*')) return [glob];
  const match = /^([^*]+)\/\*$/.exec(glob);
  if (!match) {
    throw new Error(
      `pnpm-workspace.yaml: glob "${glob}" is a shape this enumeration does not handle. ` +
        `Teach it the shape rather than dropping the glob: an unhandled glob silently ` +
        `narrows what the ADR-048 checks cover, which is the failure they exist to stop.`,
    );
  }
  const parent = join(REPO_ROOT, match[1]);
  if (!existsSync(parent)) return [];
  return readdirSync(parent)
    .filter((entry) => statSync(join(parent, entry)).isDirectory())
    .map((entry) => `${match[1]}/${entry}`);
}

/**
 * Every workspace member, sorted by directory.
 *
 * @returns {{dir: string, name: string, scripts: Record<string, string>}[]}
 */
export function workspaceMembers() {
  const members = readWorkspaceGlobs()
    .flatMap(expand)
    .filter((dir) => existsSync(join(REPO_ROOT, dir, 'package.json')))
    .sort()
    .map((dir) => {
      const manifest = JSON.parse(readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8'));
      return { dir, name: manifest.name ?? '(unnamed)', scripts: manifest.scripts ?? {} };
    });

  if (members.length === 0) {
    throw new Error('No workspace members found. That is itself a failure: check pnpm-workspace.yaml.');
  }
  return members;
}
