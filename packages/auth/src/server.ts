import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP } from "better-auth/plugins";
import { isAPIError } from "better-auth/api";
import { AUTH_BASE_PATH, OTP_EXPIRY_SECONDS, OTP_LENGTH, OTP_MAX_ATTEMPTS, } from "./options.js";
import { type OtpType } from "./options.js";
import {
    injishiPhone,
    otpSendCap,
    type SendPhoneRemovedNotice,
    type SendSms,
} from "./phone.js";
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
}
/** The part of Better Auth's context logger the error hook writes to. */
interface ErrorLogger {
    error: (message: string, ...args: unknown[]) => void;
}
/**
 * Better Auth's `onAPIError.onError`, when the API asks to hear about faults.
 *
 * Setting the hook skips Better Auth's own logging, so the first half below
 * repeats it as 1.6.11 writes it (`better-auth/dist/api/index.mjs`): a schema
 * error logs its message, an `APIError` logs only when it is a 500, anything
 * else logs its name and itself. Then the fault goes to the callback. Neither
 * half may throw: an error handler that throws turns one fault into two.
 */
function serverErrorHook(onServerError: (error: unknown) => void) {
    return (error: unknown, ctx: { logger?: ErrorLogger }): void => {
        try {
            logAsBetterAuthWould(error, ctx?.logger);
        } catch {
            // The log is a courtesy; the report below is the point.
        }
        if (isClientError(error)) return;
        try {
            onServerError(error);
        } catch {
            // A reporter failure never changes what the person is told.
        }
    };
}
/** An `APIError` whose status is below 500: an answer the route meant to give. */
function isClientError(error: unknown): boolean {
    if (!isAPIError(error)) return false;
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" && statusCode < 500;
}
function logAsBetterAuthWould(error: unknown, logger: ErrorLogger | undefined): void {
    const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : null;
    if (message !== null && /no column|column|relation|table|does not exist/.test(message)) {
        logger?.error(message);
        return;
    }
    if (isAPIError(error)) {
        const status = (error as { status?: unknown }).status;
        if (status === "INTERNAL_SERVER_ERROR") logger?.error(status, error);
        return;
    }
    const name = error && typeof error === "object" && "name" in error ? error.name : "";
    logger?.error(typeof name === "string" ? name : "", error);
}
/**
 * The single Injishi Better Auth instance (F-S01, D7).
 *
 * Passwordless by default: email-OTP (primary) + Google OAuth, both issuing a
 * session that resolves to one User by verified email. Passwords are never
 * prompted. Apple is intentionally NOT configured here — the UI shows it as a
 * disabled placeholder until Sign in with Apple is provisioned.
 *
 * IDs are left to the database (`generateId: false`) so Postgres'
 * `gen_random_uuid()` default fills the uuid PKs the schema already declares.
 */
export function createAuth(config: CreateAuthConfig): AuthInstance {
    const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
    if (config.google?.clientId && config.google?.clientSecret) {
        socialProviders.google = {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
        };
    }
    return betterAuth({
        secret: config.secret,
        baseURL: config.baseURL,
        basePath: AUTH_BASE_PATH,
        trustedOrigins: config.trustedOrigins,
        /*
         * The per-IP backstop, sized for a shared network rather than one person.
         *
         * Better Auth's email-OTP plugin allows THREE requests a minute per IP on
         * each code path, and counts the successful ones. The key is the client
         * IP, and a whole office, a demo room or a mobile carrier's NAT is one
         * IP: the fourth person to sign in inside a minute was refused with
         * "That's a lot of tries in a short time", and so was everyone after
         * them. On 2026-09-15 that locked real people out of the demo.
         *
         * The IP count was never the brute-force control, so raising it gives
         * nothing away. A code dies after `OTP_MAX_ATTEMPTS` wrong guesses and
         * expires in `OTP_EXPIRY_SECONDS`, and `otpSendCap` budgets sends per
         * address. What stays here is a ceiling on one IP hammering the API.
         */
        rateLimit: {
            customRules: {
                "/sign-in/email-otp": { window: 60, max: 100 },
                "/email-otp/check-verification-otp": { window: 60, max: 100 },
                "/email-otp/send-verification-otp": { window: 60, max: 30 },
            },
        },
        database: drizzleAdapter(config.db, {
            provider: "pg",
            // Tables are plural (`users`, `sessions`, ...); map the singular models.
            usePlural: true,
            /*
             * Left OFF by the adapter's own default, which makes every multi-step
             * write run one statement at a time.
             *
             * Moving a phone number cannot survive that. `users_phone_number_uk`
             * is unique, so clearing the losing account and setting the winning
             * one are two halves of one change: run them apart and a crash
             * between them either strands the number on nobody, or fails the
             * second write after the first already told somebody their number was
             * removed. Turning it on also makes Better Auth's own multi-step
             * writes atomic, which is a gain and not a risk.
             */
            transaction: true,
        }),
        /*
         * `twoFactorVerifiedAt` is owned by F-S02, not by Better Auth. Declaring
         * it here lets the session-create hook write it through the adapter; the
         * API's `TwoFactorService` also writes it through drizzle directly.
         */
        session: {
            additionalFields: {
                twoFactorVerifiedAt: {
                    type: "date",
                    required: false,
                    input: false,
                },
            },
        },
        /*
         * Email OTP already proved control of the mailbox. Asking for a second
         * emailed code on the same session is the same factor twice, which is
         * what made sign-in feel like "OTP verification coming twice". Mark the
         * session stepped up at create time ONLY on `/sign-in/email-otp`.
         *
         * Google and phone sign-in deliberately omit this mark: Google never
         * proved the mailbox with a code, and ADR-039 AC-11 forbids a phone
         * session from skipping the emailed step-up.
         */
        databaseHooks: {
            session: {
                create: {
                    before: async (
                        session: {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null;
                            userAgent?: string | null;
                        } & Record<string, unknown>,
                        ctx: { path?: string } | null,
                    ) => {
                        const path =
                            ctx && typeof ctx.path === "string" ? ctx.path : "";
                        if (path !== "/sign-in/email-otp") {
                            return { data: session };
                        }
                        return {
                            data: {
                                ...session,
                                twoFactorVerifiedAt: new Date(),
                            },
                        };
                    },
                },
            },
        },
        advanced: {
            // Let Postgres' gen_random_uuid() default generate the uuid PKs.
            database: { generateId: false },
            // Omitted rather than set to a default, so an instance that does not ask
            // for a prefix gets Better Auth's own and nothing about the three
            // existing apps moves.
            ...(config.cookiePrefix ? { cookiePrefix: config.cookiePrefix } : {}),
            // Widen the session cookie to a shared parent domain when one is given,
            // so sibling app origins can read it. Omitted otherwise, which leaves
            // Better Auth's host-only default untouched.
            ...(config.cookieDomain
                ? {
                    crossSubDomainCookies: {
                        enabled: true,
                        domain: config.cookieDomain,
                    },
                }
                : {}),
        },
        /*
         * NO RATE LIMITS ON THE DEMO INSTANCE, for the reason
         * `otpSendCap({ enforce })` below gives: its code is fixed and published,
         * so a limit guards nothing. It did lock people out: the email-OTP plugin
         * allows 3 sign-ins and 3 sends a MINUTE per IP, and a room of people
         * trying the demo from one office or one carrier NAT shares an IP, so the
         * fourth person read "That's a lot of tries in a short time".
         * Production passes no `demoOtpCode` and keeps every limit.
         */
        ...(config.demoOtpCode ? { rateLimit: { enabled: false } } : {}),
        // ADR-063 AC-12. Omitted unless asked for, so an instance with no
        // reporter keeps Better Auth's own error handling untouched.
        ...(config.onServerError
            ? { onAPIError: { onError: serverErrorHook(config.onServerError) } }
            : {}),
        // Passwordless by default (F-S01 §6): password is an optional add-on,
        // never prompted at signup, so email+password sign-in stays off.
        emailAndPassword: { enabled: false },
        socialProviders,
        plugins: [
            emailOTP({
                otpLength: OTP_LENGTH,
                expiresIn: OTP_EXPIRY_SECONDS,
                // A wrong guess burns a code after OTP_MAX_ATTEMPTS, except on the
                // demo, where the code is published and a burnt one only strands
                // the visitor who mistyped it.
                allowedAttempts: config.demoOtpCode
                    ? Number.MAX_SAFE_INTEGER
                    : OTP_MAX_ATTEMPTS,
                // Better Auth stores OTPs in plaintext by default. A live sign-in code
                // sitting in `verifications.value` turns any read of that table (a
                // backup, a support query, an injection) into account takeover on any
                // account, so hash them at rest.
                storeOTP: "hashed",
                // Demo instances issue a fixed, known code so a demo can sign in with
                // no mailbox; production omits `demoOtpCode`, so this falls back to
                // Better Auth's random generator. Still stored hashed + verified
                // normally — deterministic, not bypassed.
                ...(config.demoOtpCode ? { generateOTP: () => config.demoOtpCode } : {}),
                // First OTP sign-in for a new verified email creates the User
                // (default role Guest is granted by the domain, downstream).
                sendVerificationOTP: async ({ email, otp, type }) => {
                    await config.sendOtp({ email, otp, type: type });
                },
            }),
            // The OTP send cap (AC-12). Always installed: it protects the EMAIL
            // budget too, which is the hole F-S01 §9 recorded and nothing closed.
            // Counted everywhere but the demo, whose fixed code and shared
            // personas make a per-address budget a lockout with nothing behind it.
            otpSendCap({ enforce: !config.demoOtpCode }),
            // The native app's session (ADR-038). A phone keeps no cookie jar, so
            // it reads the signed session token from the `set-auth-token` response
            // header this plugin adds, and sends it back as `Authorization:
            // Bearer`. Without it every signed in mobile call is a 401. The
            // browser apps never send that header and keep using the cookie.
            // `requireSignature` refuses a bare session id: only the signed value
            // the header carried is accepted.
            bearer({ requireSignature: true }),
            // Phone sign in, only where a handset can actually be reached.
            ...(config.sendSms && config.sendPhoneRemovedNotice
                ? [
                    injishiPhone({
                        sendSms: config.sendSms,
                        // The join step mails its code through the SAME sender the
                        // ordinary email sign in uses, so there is one place that
                        // knows how a code reaches a person.
                        sendEmailOtp: config.sendOtp,
                        sendPhoneRemovedNotice: config.sendPhoneRemovedNotice,
                    }),
                ]
                : []),
        ],
    });
}


