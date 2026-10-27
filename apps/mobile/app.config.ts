// One app, three builds that sit side by side on a phone (mobile spec 0001, D-j). APP_VARIANT picks
// the build: EAS sets it from the environment named after the profile, and on this PC it is unset,
// which means development. The production entry keeps the identity the app shipped with in app.json.
//
// Nothing here is a secret: this file, eas.json and every EXPO_PUBLIC_ value end up in the build.

import type { ConfigContext, ExpoConfig } from "expo/config";

type Variant = "development" | "preview" | "production";

const VARIANTS: Record<Variant, { id: string; name: string; scheme: string; icon: string; adaptiveIcon: string }> =
  {
    development: {
      id: "com.injishi.app.dev",
      name: "Injishi Dev",
      scheme: "injishi-dev",
      icon: "./assets/icon-dev.png",
      adaptiveIcon: "./assets/adaptive-icon-dev.png",
    },
    preview: {
      id: "com.injishi.app.preview",
      name: "Injishi Preview",
      scheme: "injishi-preview",
      icon: "./assets/icon-preview.png",
      adaptiveIcon: "./assets/adaptive-icon-preview.png",
    },
    production: {
      id: "com.injishi.app",
      name: "Injishi",
      scheme: "injishi",
      icon: "./assets/icon.png",
      adaptiveIcon: "./assets/icon.png",
    },
  };

function variant(): Variant {
  const value = process.env.APP_VARIANT || "development";
  if (value in VARIANTS) return value as Variant;
  throw new Error(`APP_VARIANT must be development, preview or production; got "${value}".`);
}

// Printed by `eas init` in the injishi organization (spec 0001, AC-3). eas init cannot write a
// TypeScript config, so a new project's values are copied here by hand and checked with
// `npx expo config --type public`.
const EAS_PROJECT_ID = "0a201d41-84df-4ed5-9fc6-3c9a78b68876";
const OWNER = "injishi";

export default ({ config }: ConfigContext): ExpoConfig => {
  const build = VARIANTS[variant()];
  return {
    ...config,
    name: build.name,
    slug: "injishi",
    owner: OWNER,
    scheme: build.scheme,
    // Raised by hand per store release. Build numbers are EAS's (appVersionSource: remote).
    version: "0.1.0",
    orientation: "portrait",
    icon: build.icon,
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: build.id,
      supportsTablet: false,
    },
    android: {
      package: build.id,
      adaptiveIcon: {
        foregroundImage: build.adaptiveIcon,
        backgroundColor: "#E8F3F0",
      },
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/icon.png",
    },
    // Any native change gives a new runtime version by itself, so an update never reaches a build
    // it would crash (D-o). fingerprint.config.js leaves the version fields out.
    runtimeVersion: { policy: "fingerprint" },
    updates: {
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      // Check on launch without making launch wait; a downloaded update runs on the next cold start (D-p).
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },
    experiments: {
      typedRoutes: true,
    },
    plugins: ["expo-router", "expo-sqlite", "expo-font", "expo-dev-client", "expo-updates"],
    extra: {
      eas: { projectId: EAS_PROJECT_ID },
    },
  };
};
