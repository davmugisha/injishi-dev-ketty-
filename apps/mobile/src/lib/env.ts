// Where the phone reaches the API. `pnpm dev:all` sets EXPO_PUBLIC_API_URL to this laptop's LAN address,
// because on a phone "localhost" is the phone; a release build sets the public origin.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
