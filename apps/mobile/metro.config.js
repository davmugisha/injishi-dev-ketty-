// Expo's default Metro config already understands pnpm workspaces (watch folders, node_modules paths).
// Uniwind must be the outermost wrapper.
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const { withoutSampleData } = require("./metro/sample-data");

const config = withoutSampleData(getDefaultConfig(__dirname));

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/global.css",
  dtsFile: "./src/uniwind-types.d.ts",
});
