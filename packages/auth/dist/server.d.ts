import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { type OtpType } from "./options.js";
import { type SendPhoneRemovedNotice, type SendSms } from "./phone.js";
import { type MayHoldPassword } from "./password-gate.js";
export { PASSWORD_CODE_RESET_PATH, PASSWORD_CODE_SEND_PATHS, PASSWORD_NOT_OFFERED, type MayHoldPassword, } from "./password-gate.js";
/** Delivers an OTP to the user. The backend plugs in its mailer seam's sender (SMTP through nodemailer). */
export type SendOtp = (args: {
    email: string;
    otp: string;
    type: OtpType;
}) => Promise<void>;
/**
 * The slice of the Better Auth instance the backend actually consumes. Declared
 * explicitly (rather than inferred) so the emitted types stay portable across
 * the pnpm workspace — the full inferred instance references library-internal
 * paths that TypeScript cannot name (TS2742).
 */
export interface AuthInstance {
    /** Fetch-style handler mounted at /api/auth/*. */
    handler: (request: Request) => Promise<Response>;
    /** Server-side API (session lookup, etc.) used by NestJS guards. */
    api: Record<string, unknown>;
    options: Record<string, unknown>;
}
export interface CreateAuthConfig {
    /**
     * A Drizzle (node-postgres) database instance whose schema already contains
     * the Better-Auth tables `users` / `sessions` / `accounts` / `verifications`
     * (see server/api schema §4.1). Typed loosely so this package needn't
     * depend on the backend's schema module.
     */
    db: Parameters<typeof drizzleAdapter>[0];
    /** Signing secret for sessions / cookies. */
    secret: string;
    /** Public origin of the auth server, e.g. http://localhost:8000. */
    baseURL: string;
    /**
     * The cookie name prefix this instance signs with, e.g. "injishi-oversight".
     *
     * Omit it and Better Auth uses its own default, `better-auth`, which is what
     * the marketplace instance has always used and must keep using.
     *
     * IT IS HALF OF A SESSION BOUNDARY, not a cosmetic name. Two instances that
     * share a cookie name overwrite each other in the browser; two that share a
     * SECRET verify each other's cookies, which removes the boundary silently.
     * A separate surface needs both its own prefix and its own `secret`.
     *
     * Set this and you must tell the edge gate the same names, through
     * `sessionCookieNames(prefix)` in `./edge`. The gate cannot read this config:
     * it runs in middleware with no server and no database. A gate looking for
     * the wrong name sees no cookie and bounces a signed-in officer to sign in,
     * forever.
     */
    cookiePrefix?: string;
    /**
     * The domain to set the session cookie on, e.g. ".injishi.com".
     *
     * WHAT IT FIXES. The apps and the API are separate deployments on separate
     * hosts. Left unset, Better Auth writes a HOST-ONLY cookie with
     * `SameSite=Lax`, and both halves of that are fatal across an origin
     * boundary: `Lax` is never returned on a cross-SITE request, so a browser on
     * `www.example.com` will not carry it to an API on `api.vendor.dev` at all;
     * and host-only means the cookie is not sent to any OTHER host either, so an
     * app's own Next.js middleware — which reads the cookies sent to ITS origin —
     * cannot see it even when the API is a sibling subdomain.
     *
     * Setting this to the shared parent (`.injishi.com`) answers both. The cookie
     * becomes same-site for every `*.injishi.com` origin, so `Lax` is satisfied
     * without widening it to `None`, and it is delivered to the operator app's
     * own origin, so its gate can verify a session instead of bouncing a
     * signed-in operator back to sign-in forever.
     *
     * IT ONLY WORKS IF THE API IS ON THAT DOMAIN. A cookie may only be set for a
     * domain the response's own host belongs to; an API on `*.up.railway.app`
     * cannot set one for `.injishi.com` and the browser silently drops it. So
     * this is configured together with the API's public hostname, or not at all.
     *
     * Omit it and nothing moves: no `domain` attribute, exactly the behaviour
     * every existing deployment and the local dev stack already have.
     */
    cookieDomain?: string;
    /** Origins allowed to initiate auth + receive OAuth redirects (web, admin). */
    trustedOrigins: string[];
    /** Google OAuth credentials. Omit to hide the provider. */
    google?: {
        clientId: string;
        clientSecret: string;
    };
    /** How OTP emails are delivered (the backend's mailer seam: SMTP to a relay in production). */
    sendOtp: SendOtp;
    /**
     * How a phone sign-in code reaches a handset (ADR-039).
     *
     * OPTIONAL, AND ITS ABSENCE IS THE SWITCH. Omit it and the phone endpoints
     * are not mounted at all, so a deployment with no SMS adapter cannot offer a
     * sign-in route it has no way to complete. The email send cap is installed
     * either way, because an email budget needs protecting whether or not phone
     * sign in exists.
     */
    sendSms?: SendSms;
    /**
     * Tells an account that its phone number was taken by somebody who proved
     * both that number and an email address (ADR-039 AC-8).
     *
     * Required WITH `sendSms` and meaningless without it: recycling is the whole
     * reason it exists, and a recycled Rwandan number with nobody told is a
     * silent account takeover.
     */
    sendPhoneRemovedNotice?: SendPhoneRemovedNotice;
    /**
     * Demo-environment fixed OTP (e.g. "123456"). When set, every code this
     * instance issues IS this value — generated, hashed at rest, and verified
     * through the normal path (no verification bypass); it is simply
     * deterministic so a demo can sign in without a mailbox.
     *
     * SECURITY CONTRACT: pass this ONLY when building the demo instance, which
     * is a separate `createAuth(...)` bound to the demo database (see
     * docs/pms-implementation-plan.md §Phase 2). The production instance never
     * receives it, so a fixed code is structurally unreachable in production —
     * not a runtime flag that could be flipped by mistake. Leave undefined for
     * production.
     */
    demoOtpCode?: string;
    /**
     * Told about a server fault inside Better Auth's own routes, `/api/auth/*`
     * (ADR-063 AC-12): any error that is not an `APIError` below 500. A refused
     * code, a bad origin or a rate limit is an answer, not a fault, and is never
     * passed on.
     *
     * Those routes are mounted on Fastify directly, outside Nest, so the API's
     * exception filter never sees them; this is how their faults reach the same
     * reporter. This package never imports Sentry: the API passes a callback.
     *
     * Setting it does not quiet Better Auth: its own log line for the error is
     * still written first, exactly as it would have been without the hook.
     */
    onServerError?: (error: unknown) => void;
    /**
     * Whether this user may hold a password: a tenant (a `tenants.user_id`
     * link, or an open or accepted lease invitation to their address).
     * Passwords are for tenants only (2026-10-23); everybody else signs in
     * with an emailed code.
     *
     * Omit it and nobody can set a first password. A person who already has
     * one can still sign in with it, change it and reset it.
     */
    mayHoldPassword?: MayHoldPassword;
    /**
     * Whether this user may sign in at all (2026-11-02): false while staff
     * have suspended the account. Asked before every session is made, so a
     * suspended person is refused at every sign in route alike. Omit it and
     * everybody may.
     */
    maySignIn?: (userId: string) => Promise<boolean>;
    /**
     * Told after a session is made, for the sign in history staff read
     * (`sign_in_events`). A failure here never fails the sign in.
     */
    onSignIn?: (event: SignInEvent) => Promise<void>;
}
/** One sign in, as `onSignIn` hears it. `path` is the Better Auth route that made the session. */
export interface SignInEvent {
    userId: string;
    sessionId: string;
    path: string;
    ipAddress: string | null;
    userAgent: string | null;
}
/**
 * The routes whose new session is marked stepped up (F-S02) as it is made.
 *
 * Each one proved a secret only the person holds, on this request:
 *
 * - `/sign-in/email-otp`: a code read out of the mailbox.
 * - `/sign-in/email`: the password. Only a tenant can hold one
 *   (`password-gate.ts`), and only on an account whose mailbox was proved
 *   first: accounts are made by an email code (`disableSignUp`). So a
 *   password session is no weaker than a code session. Landlords, brokers,
 *   admins and leaders never have a password, so for them nothing changes.
 * - `/change-password`: the current password again. With "sign out of other
 *   devices" Better Auth replaces this session with a new one, and without
 *   the mark the person who just proved their password would be asked for a
 *   code on their next screen.
 *
 * Google and phone sign-in are deliberately absent: Google never proved the
 * mailbox with a code, and ADR-039 AC-11 forbids a phone session from skipping
 * the emailed step-up.
 */
/** The refusal code a suspended account's sign in answers. */
export declare const ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED";
export declare const STEPPED_UP_PATHS: ReadonlySet<string>;
/**
 * The single Injishi Better Auth instance (F-S01, D7).
 *
 * Email OTP (primary) + Google OAuth, both issuing a session that resolves to
 * one User by verified email. A tenant may add a password when they accept a
 * lease invitation (2026-10-23); nobody else is offered one. Apple is
 * intentionally NOT configured here: the UI shows it as a disabled
 * placeholder until Sign in with Apple is provisioned.
 *
 * IDs are left to the database (`generateId: false`) so Postgres'
 * `gen_random_uuid()` default fills the uuid PKs the schema already declares.
 */
export declare function createAuth(config: CreateAuthConfig): AuthInstance;
//# sourceMappingURL=server.d.ts.map