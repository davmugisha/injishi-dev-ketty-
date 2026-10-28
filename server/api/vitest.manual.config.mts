import { defineConfig } from 'vitest/config';

import base from './vitest.config.mts';

/**
 * The suites that never run with the rest, each because it reaches something real: `*.live.ts` spends money
 * on the live model, and `*.integration-spec.ts` delivers to a real SMTP server. Neither name matches
 * `*.spec.ts`, so the unit suite never collects them, and Vitest will not run a file outside `include` even
 * when it is named. This config is how one runs, by name:
 *
 *   pnpm --filter @injishi/api exec vitest run --config vitest.manual.config.mts assistant.live
 *
 * It replaces `include` rather than adding to it, so a run here never drags the whole unit suite along.
 */
export default defineConfig({
  ...base,
  test: { ...base.test, include: ['src/**/*.live.ts', 'src/**/*.integration-spec.ts'] },
});
