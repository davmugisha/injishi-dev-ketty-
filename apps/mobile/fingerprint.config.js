// What the runtime version (the fingerprint of the app's native side, mobile spec 0001 D-o) leaves out.
// The version fields: raising `version` alone changes no native code, so it must not strand the builds
// already installed. If AC-9's cross machine test finds a source that differs between this Windows PC
// and EAS's Linux builders, its `ignorePaths` entry goes here too.

/** @type {import('@expo/fingerprint').Config} */
const config = {
  sourceSkips: ["ExpoConfigVersions"],
};

module.exports = config;
