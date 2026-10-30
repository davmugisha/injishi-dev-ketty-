import { createRequire } from 'node:module';

import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

/**
 * Vitest for the API (2026-10-28). It replaced Jest and ts-jest, the last Jest in the workspace, so the API
 * runs the same runner, and the same `test`, `test:unit` and `test:watch` scripts, as web, app, ui and utils.
 *
 * The suite is every `src/**\/*.spec.ts`, in Node. Specs import `describe`, `it`, `expect` and `vi` from
 * `vitest` rather than reading globals, so a spec says which runner it was written for.
 *
 * Nest's dependency injection reads the constructor types TypeScript records as decorator metadata. Vite
 * takes `experimentalDecorators` and `emitDecoratorMetadata` from tsconfig.json, the file `nest build`
 * compiles with, so the tests and the build record the same types with no setting here (checked
 * 2026-10-28: `WorkspaceGuard`'s `design:paramtypes` read WorkspaceService, TwoFactorService, Reflector).
 *
 * `zod` is pinned to its CommonJS build. `@injishi/contracts` is compiled to CommonJS, so its schemas
 * `require('zod')`, while Vitest loads this package's own source as ES modules, whose `import 'zod'` would
 * otherwise get zod's ESM build: two copies, two `ZodError` classes, and `err instanceof ZodError` in
 * `ZodValidationPipe` failing on every contract schema, so a bad request answered 500 instead of 400.
 * The built API is CommonJS throughout and loads one copy; this makes the tests load the same one.
 *
 * This file is not in tsconfig.json, unlike the other members' configs: the API compiles as CommonJS,
 * where `import.meta` does not exist. Vitest bundles it on its own.
 */
export default defineConfig({
  resolve: { alias: [{ find: /^zod$/, replacement: require.resolve('zod') }] },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
