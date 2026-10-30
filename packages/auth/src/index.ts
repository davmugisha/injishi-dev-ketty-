/**
 * @injishi/auth — single source of truth for Better Auth (F-S01, D7).
 *
 * - Server config:  import { createAuth } from "@injishi/auth/server"
 * - React client:   import { makeAuthClient } from "@injishi/auth/client"
 * - Shared consts:  import { OTP_EXPIRY_SECONDS } from "@injishi/auth"
 *
 * The root entry re-exports the server + shared constants (no react/DOM deps),
 * so the NestJS backend can import "@injishi/auth" directly. The react client
 * lives behind the "/client" subpath so server consumers never pull it in.
 */
export * from "./options.js";
export * from "./otp-budget.js";
export * from "./phone.js";
export * from "./server.js";
export type { AuthResult, InjishiAuthClient } from "./client.js";
// The demo's cookie strip (ADR-043 AC-14), for the API's first request hook.
// Re-exported rather than reached through "/edge" because the API resolves
// packages the node10 way, which cannot see subpath exports. `edge.ts` imports
// nothing but the shared constants, so this pulls in no runtime.
export {
    OVERSIGHT_COOKIE_PREFIX,
    dropForeignSessionCookies,
    isProductionSessionCookie,
} from "./edge.js";// The password rule and its sentences (tenants only, 2026-10-23).
export * from "./password.js";
