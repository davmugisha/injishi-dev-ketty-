import { readConfig } from './config.ts';
import { buildMockApis } from './server.ts';

/**
 * Injishi Mock APIs: `pnpm mock-apis:dev` from the repository root.
 *
 * Refuses to start under NODE_ENV=production unless told it is a sample
 * stack: a mock provider reachable from a production API is how invented
 * identities and imaginary money reach real accounts. The API refuses the
 * other end too (a `sandbox` seam over a real database will not boot).
 */

if (process.env.NODE_ENV === 'production' && process.env.MOCK_APIS_ALLOW_PRODUCTION_NODE_ENV !== 'sample-stack') {
  console.error(
    '[mock-apis] Refusing to start with NODE_ENV=production. This server invents people, companies and money. ' +
      'On a sample stack (staging, the demo), set MOCK_APIS_ALLOW_PRODUCTION_NODE_ENV=sample-stack.',
  );
  process.exit(1);
}

const config = readConfig();
const { server, stop } = buildMockApis(config);

server.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  console.log(`[mock-apis] Injishi Mock APIs on http://${config.host}:${port}`);
  console.log(`[mock-apis] Console: ${config.publicUrl}/`);
  console.log(`[mock-apis] State: ${config.dataDir ?? 'in memory only'}`);
});

const shutdown = (): void => {
  stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2_000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
