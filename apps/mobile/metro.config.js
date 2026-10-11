// Metro config for the Injishi mobile app (apps/mobile) inside the pnpm monorepo.
//
// Every app pins the same React now (Expo SDK 54 / RN 0.81 and the Next.js apps
// all sit on 19.1.0), so the version split that first forced this shim is gone.
// The hazard is not: the workspace still carries a second React (server/api
// resolves 19.2.8 through better-auth and resend), pnpm gives every dependency
// its own `react` symlink, and Metro watches the workspace root. One dependency
// resolved against the other copy would put two Reacts in the web bundle and
// every hook call would blow up with "Cannot read properties of null (reading
// 'useMemo')". We pin react + react-dom (and their subpaths) to this app's own
// copy so exactly one React is ever bundled, whatever the rest of the workspace
// resolves. Keep it even while the versions agree. Scoped to this app only.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Expo's default config with Sentry's additions (ADR-063): a debug id stamped
// into every bundle and its source map, which is how a release build's stack
// trace is read back to the original file and line. Web replay and the web
// feedback widget are left out because this app turns both off. The Expo
// Router error boundary is NOT auto wrapped: the root crash screen reports
// through `reportRenderError`, which keeps the reference it shows and the
// event it sends the same thing. Every customisation below is unchanged, and
// the resolveRequest shim at the bottom chains to Sentry's resolver.
const config = getSentryExpoConfig(projectRoot, {
  includeWebReplay: false,
  includeWebFeedback: false,
});

// Resolve node_modules from this app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Watch this app, the root node_modules, and the shared packages — and NOTHING
// else in the workspace.
//
// Do not widen this to [workspaceRoot]. That is what it used to be, "so shared
// packages resolve", and it put `.git` — a ~151 MB pack — plus every stray root
// file inside the watched set. On Windows there is no watchman, so the recursive
// watch over a tree that size could not come up inside @expo/metro-file-map's
// MAX_WAIT_TIME; the watcher rejected with "Failed to start watch mode",
// fileMap.build() never resolved, and DependencyGraph._resolutionCache stayed
// undefined, which surfaced as every bundle request failing with an opaque
// Metro 500.
//
// Do not drop it back to the default either, which is what replaced it. Now that
// admin lives in this repo, getDefaultConfig returns ELEVEN workspace members,
// and the four this app never imports — apps/web, apps/app, apps/admin and
// server/api — are precisely the four whose dev servers rewrite build output
// continuously. That is not merely wasted crawling: @expo/metro-file-map's
// FallbackWatcher (the no-watchman path, i.e. Windows) calls fs.watch(dir)
// unguarded in #watchdir, and a directory that disappears between the walk
// enumerating it and that call throws ENOENT synchronously. #checkedEmitError
// only filters errors the watcher emits after construction, so the throw is
// uncaught and takes the process down. `pnpm mobile:start` alongside
// `pnpm admin:dev` died on exactly that, watching a Next export temp directory:
//   ENOENT: no such file or directory, watch
//   'apps\admin\.next\export\_next\FkCOhjWip7mJDc7EVN3vj'
//
// resolver.blockList does NOT prevent this. It governs resolution and file-map
// contents; the watcher still descends into a blocked path to set up watches.
// Keeping the directory out of the watch set is the only fix that holds.
//
// packages/* stays watched on purpose, all five rather than just the two this
// app imports: they are small, they churn only on a deliberate rebuild, and
// watching them is what makes `tsc -p packages/contracts` hot-reload the app.
config.watchFolders = [
  path.resolve(workspaceRoot, 'node_modules'),
  projectRoot,
  ...['auth', 'contracts', 'design-tokens', 'ui', 'utils'].map((p) =>
    path.resolve(workspaceRoot, 'packages', p),
  ),
];

// Belt and braces. The watchFolders list above already keeps apps/*/.next and
// server/api/dist out of the watched set, so these two patterns are redundant
// as long as it stays narrow — Metro's own blockList covers only `.expo/types`
// and the native build dirs, and would not catch either. They are kept so that
// widening watchFolders again cannot silently readmit the two directories the
// web, operator, admin and API dev servers rewrite continuously while
// `pnpm mobile:start` runs. Each such write invalidates the file map and buys
// another crawl, which is the difference between a bundle that finishes and one
// that appears to hang forever.
//
// Scope matters. `packages/contracts` and `packages/auth` ship only compiled
// `dist/` (ADR-034) and this app imports both, so a blanket /dist/ rule would
// break resolution. `server/api/dist` is excluded by its full path instead.
//
// blockList is a single RegExp (metro-config builds its default with
// exclusionList()), so the defaults are folded in by source rather than
// replaced.
const escapeForRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const root = escapeForRegExp(workspaceRoot);
const sep = '[\\\\/]';
const notSep = '[^\\\\/]+';

config.resolver.blockList = new RegExp(
  [
    ...[config.resolver.blockList]
      .flat()
      .filter(Boolean)
      .map((re) => re.source),
    `^${root}${sep}apps${sep}${notSep}${sep}\\.next${sep}`,
    `^${root}${sep}server${sep}api${sep}dist${sep}`,
  ].join('|'),
);

const singletons = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [name, dir] of Object.entries(singletons)) {
    if (moduleName === name || moduleName.startsWith(`${name}/`)) {
      const sub = moduleName.slice(name.length); // '' or '/client' etc.
      return context.resolveRequest(
        context,
        sub ? path.join(dir, sub) : dir,
        platform,
      );
    }
  }
  return (originalResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

// Send a phone the bundle gzipped, not as a multipart stream.
//
// Expo Go and the dev client ask for the bundle with `Accept: multipart/mixed`
// so they can draw a progress bar. Metro answers that with the whole dev bundle
// UNCOMPRESSED — 17.3 MB here — because the dev server's gzip skips multipart
// content types, and it spends ~4s on a warm graph building the stream. The
// same request without the multipart ask comes back as plain JavaScript, which
// IS gzipped: 2.8 MB, built in ~0.2s. On a phone over 2.4 GHz Wi-Fi the 17 MB
// stream crawled or stalled outright, and Expo Go's bar sat still for minutes
// (2026-10-05). Dropping the ask costs the percentage on the loading screen
// and nothing else: React Native's bundle downloader takes a plain response
// as readily as a multipart one, and has no read timeout to trip during a cold
// build. Native bundle requests only; web loads its bundle from a script tag.
const originalEnhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const inner = originalEnhanceMiddleware
    ? originalEnhanceMiddleware(metroMiddleware, server)
    : metroMiddleware;
  return (req, res, next) => {
    const url = req.url ?? '';
    if (
      /\.bundle(\?|$)/.test(url) &&
      /[?&]platform=(android|ios)(&|$)/.test(url) &&
      req.headers.accept?.includes('multipart/mixed')
    ) {
      req.headers.accept = 'application/javascript';
    }
    return inner(req, res, next);
  };
};

module.exports = config;
