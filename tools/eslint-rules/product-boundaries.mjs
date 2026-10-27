/**
 * `injishi/product-boundaries` and `injishi/no-demo-data`: the import rules of
 * ADR-074 (D-f, `074-repository-and-boundaries.md` § Import rules).
 *
 * The platform has four roots. `apps/` is what people run, `server/` holds
 * every rule that decides anything, `products/` holds screens and flows with no
 * authority, and `packages/` holds the building blocks. The load bearing rule
 * is that a product folder is a place to put screens, not a place to put
 * authority, and that products never import each other. Written down, that
 * boundary is one nobody keeps; this is what keeps it.
 *
 * `product-boundaries` refuses, at `error` wherever it is wired:
 *
 *  - a product importing an app;
 *  - a product importing another product (the app composes their views; the
 *    server orchestrates a flow that spans two);
 *  - a technical package importing a product;
 *  - the server importing a product (shared shapes come from
 *    `@injishi/contracts`);
 *  - client code (an app or a product, browser or native) importing the
 *    server, a server database driver, a provider SDK or `@injishi/auth/server`;
 *  - an app reaching into a product past its `exports` (`.`, `./web`,
 *    `./native`, `./styles.css`), by a deep subpath or a relative path.
 *
 * `no-demo-data` refuses production code importing `@injishi/data` or
 * `@injishi/db`, the personas, fixtures and embedded SQLite store of the demo.
 * It is a rule of its own, rather than a row of the first, because ADR-074 asks
 * for it at a different level in two places: `error` in products, `apps/web`
 * and `packages/*`, `warn` (a counted backlog, the ADR-037 idiom) in `apps/app`
 * and `apps/mobile` until stage 9 retires their callers. ESLint gives a rule one
 * level per file, so one rule could not be both. The demo's own files are
 * exempt by path (the `allow` option).
 *
 * Every import shape is read: static and type-only imports, re-exports,
 * dynamic `import()`, `require()` and `import("…")` types. A relative path is
 * resolved against the file's own location, so `../../products/pos/src/x` from
 * `products/pms` is refused as surely as `@injishi/product-pos`.
 *
 * Which root a file belongs to is read from its path relative to the
 * repository, which is two levels above this file. The product IDs are the
 * eleven of D-a; a `products/<dir>` that is not one of them is refused by
 * `pnpm check:manifests`, so the two fences agree.
 *
 * What is not here: the server's own module to module rule (one API module
 * reaches another only through an exported service, port or event). It is a
 * question about NestJS providers, not about package roots, and the import
 * cycle ratchet (`scripts/api-cycles-ratchet.mjs`) is the check that holds the
 * API's shape today.
 */

import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** ADR-074 D-a. Permanent; a brand name may change, an ID never does. */
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

/** What an app may import from a product: the `exports` a product declares. */
const PRODUCT_ENTRY_POINTS = new Set(['', 'web', 'native', 'styles.css']);

const APP_PACKAGES = new Map([
  ['@injishi/web', 'web'],
  ['@injishi/app', 'app'],
  ['@injishi/mobile', 'mobile'],
]);

const SERVER_PACKAGES = new Set(['@injishi/api']);

/**
 * Modules only the server may load. An entry ending in `/` is a scope or a
 * prefix; any other entry matches itself and its subpaths.
 *
 * The drivers are the server's (Postgres, Redis and its queue); the SDKs are
 * the providers the API holds the credentials for (S3, mail, the assistant).
 * `drizzle-orm` itself is not listed, only its Postgres entry points: the
 * demo's embedded SQLite store runs it on a phone and in `packages/db`, and
 * that store is `no-demo-data`'s to retire, not this rule's.
 */
const SERVER_ONLY = [
  '@injishi/auth/server',
  '@nestjs/',
  'pg',
  'pg-pool',
  'postgres',
  'drizzle-orm/node-postgres',
  'drizzle-orm/pg-core',
  'drizzle-orm/postgres-js',
  'drizzle-kit',
  'bullmq',
  'ioredis',
  'redis',
  '@aws-sdk/',
  'nodemailer',
  '@anthropic-ai/sdk',
];

const DEMO_PACKAGES = new Map([
  ['@injishi/data', 'data'],
  ['@injishi/db', 'db'],
]);

/** ADR-074's exemptions: the demo packages themselves, demo folders, and the app's demo sign in. */
const DEFAULT_DEMO_ALLOW = ['packages/data/**', 'packages/db/**', '**/demo/**', 'apps/app/src/server/auth.ts'];

/** A path relative to the repository, with forward slashes, or null when outside it. */
function repoPath(absolute) {
  const rel = relative(REPO_ROOT, absolute);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

/** The root a repository path sits in: a product, an app, a package or the server. */
function zoneOfPath(path) {
  if (!path) return null;
  const [root, name] = path.split('/');
  if (!name) return null;
  if (root === 'products') return { kind: 'product', id: name, path };
  if (root === 'apps') return { kind: 'app', id: name, path };
  if (root === 'packages') return { kind: 'package', id: name, path };
  if (root === 'server') return { kind: 'server', id: name, path };
  return null;
}

function serverOnly(specifier) {
  return SERVER_ONLY.find((entry) =>
    entry.endsWith('/') ? specifier.startsWith(entry) : specifier === entry || specifier.startsWith(`${entry}/`),
  );
}

/** Split `@scope/name/sub/path` into the package and its subpath. */
function splitBare(specifier) {
  const parts = specifier.split('/');
  const take = specifier.startsWith('@') ? 2 : 1;
  return { name: parts.slice(0, take).join('/'), subpath: parts.slice(take).join('/') };
}

/** What an import specifier, seen from `filename`, lands on. */
function targetOf(specifier, filename) {
  if (specifier.startsWith('.') || isAbsolute(specifier)) {
    const zone = zoneOfPath(repoPath(resolve(dirname(filename), specifier)));
    return zone ? { ...zone, relative: true } : null;
  }
  const { name, subpath } = splitBare(specifier);
  const product = /^@injishi\/product-(.+)$/.exec(name);
  if (product && PRODUCT_IDS.has(product[1])) return { kind: 'product', id: product[1], subpath, relative: false };
  if (APP_PACKAGES.has(name)) return { kind: 'app', id: APP_PACKAGES.get(name), relative: false };
  if (SERVER_PACKAGES.has(name)) return { kind: 'server', id: 'api', relative: false };
  const only = serverOnly(specifier);
  if (only) return { kind: 'server-only', id: specifier, relative: false };
  if (DEMO_PACKAGES.has(name)) return { kind: 'package', id: DEMO_PACKAGES.get(name), relative: false };
  return null;
}

/** Every string an import, re-export, `import()`, `require()` or `import("…")` type names. */
function importVisitors(check) {
  const literal = (node) => (node && node.type === 'Literal' && typeof node.value === 'string' ? node : null);
  const sourceOf = (node) => {
    const source = literal(node.source);
    if (source) check(source, source.value);
  };
  return {
    ImportDeclaration: sourceOf,
    ExportNamedDeclaration: sourceOf,
    ExportAllDeclaration: sourceOf,
    ImportExpression: sourceOf,
    CallExpression(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
        const arg = literal(node.arguments[0]);
        if (arg) check(arg, arg.value);
      }
    },
    TSImportType(node) {
      // typescript-eslint 8 wraps the string in a literal type.
      const arg = literal(node.argument?.literal ?? node.argument);
      if (arg) check(arg, arg.value);
    },
  };
}

/** @type {import('eslint').Rule.RuleModule} */
export const productBoundaries = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Products never import an app or each other, a package never imports a product, and client code never ' +
        'imports the server (ADR-074 D-e, D-f).',
    },
    schema: [],
    messages: {
      productToApp:
        '`{{specifier}}` is an app, and a product never imports one (ADR-074, Import rules: a product to an app is ' +
        'refused). The app owns the route and hands the view its data and callbacks.',
      productToProduct:
        '`{{specifier}}` is the `{{target}}` product, and `{{source}}` may not import it (ADR-074 D-e). The app ' +
        'composes the two views; when a flow spans both, the server orchestrates it.',
      packageToProduct:
        '`{{specifier}}` is the `{{target}}` product, and a technical package never imports a product (ADR-074, ' +
        'Import rules). Move the shared piece into this package, or the product into its consumer.',
      serverToProduct:
        '`{{specifier}}` is the `{{target}}` product, and the server never imports a product (ADR-074, Import ' +
        'rules). A shape both sides need belongs in `@injishi/contracts`.',
      clientToServer:
        '`{{specifier}}` is server code, and client code never imports it (ADR-074, Import rules: an app or a ' +
        'product to `server/`, a SQL driver, a provider SDK or `@injishi/auth/server` is refused). Call the API.',
      productThroughExports:
        '`{{specifier}}` reaches into the `{{target}}` product past its `exports`. Import `@injishi/product-' +
        '{{target}}`, `/web`, `/native` or `/styles.css` (ADR-074, A product package).',
    },
  },
  create(context) {
    const file = zoneOfPath(repoPath(context.filename));
    if (!file) return {};

    return importVisitors((node, specifier) => {
      const target = targetOf(specifier, context.filename);
      if (!target) return;
      const report = (messageId) =>
        context.report({ node, messageId, data: { specifier, source: file.id, target: target.id } });

      const client = file.kind === 'app' || file.kind === 'product';
      if (client && (target.kind === 'server' || target.kind === 'server-only')) return report('clientToServer');

      if (target.kind !== 'product' && !(target.kind === 'app' && file.kind === 'product')) return;

      if (file.kind === 'product') {
        if (target.kind === 'app') return report('productToApp');
        if (target.id !== file.id) return report('productToProduct');
        return;
      }
      if (file.kind === 'package') return report('packageToProduct');
      if (file.kind === 'server') return report('serverToProduct');
      if (file.kind === 'app' && (target.relative || !PRODUCT_ENTRY_POINTS.has(target.subpath ?? ''))) {
        return report('productThroughExports');
      }
    });
  },
};

/** `**` crosses folders, `*` does not. Enough glob for a list of exempt paths. */
function globToRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (char === '*') source += '[^/]*';
    else source += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

/** @type {import('eslint').Rule.RuleModule} */
export const noDemoData = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Production code never imports the demo: `@injishi/data` and `@injishi/db` are personas, fixtures and an ' +
        'embedded store (ADR-074, Import rules).',
    },
    schema: [
      {
        type: 'object',
        properties: { allow: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      demoData:
        '`{{specifier}}` is demo data, and production code never imports it (ADR-074, Import rules). Read the API ' +
        'through `@injishi/api-client`; the demo packages retire with their last caller in stage 9.',
    },
  },
  create(context) {
    const path = repoPath(context.filename);
    if (!zoneOfPath(path)) return {};
    const allow = (context.options[0]?.allow ?? DEFAULT_DEMO_ALLOW).map(globToRegExp);
    if (allow.some((pattern) => pattern.test(path))) return {};

    return importVisitors((node, specifier) => {
      const target = targetOf(specifier, context.filename);
      if (target?.kind === 'package' && (target.id === 'data' || target.id === 'db')) {
        context.report({ node, messageId: 'demoData', data: { specifier } });
      }
    });
  },
};
