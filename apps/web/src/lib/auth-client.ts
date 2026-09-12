import { makeAuthClient } from "@injishi/auth/client";

/**
 * The Injishi web auth client (F-S01). Talks to the Better Auth server mounted
 * on the API at `/api/auth`. Cross-origin (web :3000 → api :8000) with cookie
 * credentials; the API allows the web origin via CORS + Better Auth
 * trustedOrigins.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const authClient = makeAuthClient(API_URL);
