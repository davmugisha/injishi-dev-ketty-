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
 * A member under `products/` owes more (ADR-074, A product package), checked
 * by `productProblems` below: its folder is one of the eleven product IDs and
 * its name is `@injishi/product-<id>`; its `exports` offer only `.`, `./web`,
 * `./native` and `./styles.css`, and `./styles.css` is one of them; a Next app
 * that lists it in `transpilePackages` imports that stylesheet, or a class
 * used only inside the product is never generated; and nothing a consuming app
 * also lists is a product `dependencies` entry, because pnpm resolves a peer
 * bearing package once per React version and two HeroUI instances in one
 * bundle break every overlay. Those are `peerDependencies` only.
 *
 * Usage:  node scripts/check-workspace-manifests.mjs
 * Exits 0 when every member declares all three and every product holds its
 * shape, 1 otherwise, naming each gap.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT, workspaceMembers } from './workspace-members.mjs';

const REQUIRED = ['typecheck', 'lint', 'test'];

/** ADR-074 D-a. The same eleven `tools/eslint-rules/product-boundaries.mjs` reads. */
const PRODUCT_IDS = new Set([
  'account',
  'admin',
  'membership',
  'marketplace',
  'finance',
  'pay',
  'pms',
  'outlets',
  'pos',
  'hr',
  'residence',
]);
const PRODUCT_EXPORTS = new Set(['.', './web', './native', './styles.css']);

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

const manifestOf = (dir) => JSON.parse(readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8'));

/** Every `.css` file under a directory, skipping build output and installs. */
function cssFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry.startsWith('.next')) return [];
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return entry.endsWith('.css') ? [path] : [];
  });
}

/** The package names an app's Next config hands `transpilePackages`, read as text. */
function transpiledBy(appDir) {
  const config = ['next.config.ts', 'next.config.mjs', 'next.config.js']
    .map((file) => join(REPO_ROOT, appDir, file))
    .find(existsSync);
  if (!config) return [];
  const list = /transpilePackages\s*:\s*\[([^\]]*)\]/.exec(readFileSync(config, 'utf8'));
  return list ? [...list[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]) : [];
}

function productProblems() {
  const problems = [];
  const products = members.filter((member) => member.dir.startsWith('products/'));
  const apps = members.filter((member) => member.dir.startsWith('apps/'));

  for (const product of products) {
    const id = product.dir.slice('products/'.length);
    if (!PRODUCT_IDS.has(id)) {
      problems.push(`${product.dir}: \`${id}\` is not one of the eleven product IDs (ADR-074 D-a). A product ID is permanent; a new one is a decision, not a folder.`);
      continue;
    }
    if (product.name !== `@injishi/product-${id}`) {
      problems.push(`${product.dir}: named \`${product.name}\`, but a product is \`@injishi/product-${id}\` (ADR-074 D-d).`);
    }

    const manifest = manifestOf(product.dir);
    const exportKeys = typeof manifest.exports === 'object' && manifest.exports ? Object.keys(manifest.exports) : [];
    const extra = exportKeys.filter((key) => !PRODUCT_EXPORTS.has(key));
    if (extra.length > 0) {
      problems.push(`${product.name}: exports ${extra.join(', ')}. A product exposes \`.\`, \`./web\`, \`./native\` and \`./styles.css\`, and nothing else.`);
    }
    if (!exportKeys.includes('./styles.css')) {
      problems.push(`${product.name}: no \`./styles.css\` export. It carries the product's \`@source "./"\`, without which its classes are never generated.`);
    }

    for (const app of apps) {
      const appManifest = manifestOf(app.dir);
      const appDeps = { ...appManifest.dependencies, ...appManifest.devDependencies };
      if (!(product.name in appDeps)) continue;

      const doubled = Object.keys(manifest.dependencies ?? {}).filter((dep) => dep in appDeps);
      if (doubled.length > 0) {
        problems.push(
          `${product.name}: lists ${doubled.join(', ')} under dependencies, and ${app.name} does too. ` +
            'Declare them as peerDependencies only, or pnpm can put two copies in one bundle.',
        );
      }

      if (transpiledBy(app.dir).includes(product.name)) {
        const wanted = `@import "${product.name}/styles.css"`;
        const imported = cssFiles(join(REPO_ROOT, app.dir, 'src')).some((file) => readFileSync(file, 'utf8').includes(wanted));
        if (!imported) {
          problems.push(`${app.name}: transpiles ${product.name} but no stylesheet carries \`${wanted};\`. Its views would ship unstyled.`);
        }
      }
    }
  }
  return problems;
}

const problems = productProblems();
const productCount = members.filter((member) => member.dir.startsWith('products/')).length;
console.log(`${productCount} product(s) checked for the ADR-074 package shape`);
for (const problem of problems) console.error(`FAIL ${problem}`);

const failures = rows.filter((row) => row.missing.length > 0);
if (failures.length === 0 && problems.length > 0) process.exit(1);
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
