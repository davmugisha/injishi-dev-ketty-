/**
 * Jest module resolver for the Expo app.
 *
 * Two resolvers have to apply here and jest only accepts one, so this composes
 * them.
 *
 * `react-native-worklets` (pulled in by Reanimated) splits its module loader
 * into `NativeWorklets.ts` and `NativeWorklets.native.ts`. The `.native` copy
 * calls `loadUnpackers` on its TurboModule at import time, which does not exist
 * under jest, so resolving it throws before a single assertion runs and takes
 * the whole suite with it. The package ships `jest/resolver.js` for exactly
 * this: drop the `.native` extensions while resolving anything inside worklets
 * so the plain variant wins. Reanimated 4.5 / worklets 0.10 (SDK 57) need it;
 * worklets 0.5 happened to import cleanly without it.
 *
 * `jest-expo` already sets `@react-native/jest-preset`'s resolver, which does
 * the platform and Haste resolution the rest of the tree depends on. Naming a
 * `resolver` in jest.config.js replaces that rather than adding to it, so the
 * base resolver is read back off the preset and delegated to. It is reached
 * through `jest-expo` because pnpm's layout does not put
 * `@react-native/jest-preset` anywhere this app can require directly.
 */
const baseResolver = require(require('jest-expo/jest-preset').resolver);

module.exports = (request, options) => {
  const inWorklets =
    options.basedir.includes('react-native-worklets') ||
    request.includes('react-native-worklets');

  const resolveOptions = inWorklets
    ? {
        ...options,
        extensions: options.extensions?.filter((ext) => !ext.includes('native')),
      }
    : options;

  return baseResolver(request, resolveOptions);
};
