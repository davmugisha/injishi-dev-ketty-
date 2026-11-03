// Where the screens' data comes from (the proto-ui seam): "mock" is the prototype's sample data, on the
// phone, with no backend; "api" is the real API. Development sets mock in `.env.development`; a build
// that sets nothing (every EAS profile) is api, so the switch fails towards the real thing.
// Pure: no React Native import, so `node --test` reads it.

export type DataMode = "mock" | "api";

/** Only the exact word `mock` turns the sample data on. */
export function dataModeFrom(value: string | undefined): DataMode {
  return value?.trim() === "mock" ? "mock" : "api";
}

// Read as `process.env.EXPO_PUBLIC_DATA` literally: Expo inlines EXPO_PUBLIC_ values at bundle time.
export const DATA_MODE: DataMode = dataModeFrom(process.env.EXPO_PUBLIC_DATA);

/** The prototype's sample data is on screen: no guards, the launcher, forced states. */
export const isMock: boolean = DATA_MODE === "mock";
