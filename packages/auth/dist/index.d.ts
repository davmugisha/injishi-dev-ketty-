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
export { OVERSIGHT_COOKIE_PREFIX, dropForeignSessionCookies, isProductionSessionCookie, } from "./edge.js";
//# sourceMappingURL=index.d.ts.map