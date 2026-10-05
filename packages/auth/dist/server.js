import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP } from "better-auth/plugins";
import { isAPIError } from "better-auth/api";
import { AUTH_BASE_PATH, OTP_EXPIRY_SECONDS, OTP_LENGTH, OTP_MAX_ATTEMPTS, } from "./options.js";
import { injishiPhone, otpSendCap, } from "./phone.js";
/**
 * Better Auth's `onAPIError.onError`, when the API asks to hear about faults.
 *
 * Setting the hook skips Better Auth's own logging, so the first half below
 * repeats it as 1.6.11 writes it (`better-auth/dist/api/index.mjs`): a schema
 * error logs its message, an `APIError` logs only when it is a 500, anything
 * else logs its name and itself. Then the fault goes to the callback. Neither
 * half may throw: an error handler that throws turns one fault into two.
 */
function serverErrorHook(onServerError) {
    return (error, ctx) => {
        try {
            logAsBetterAuthWould(error, ctx?.logger);
        }
        catch {
            // The log is a courtesy; the report below is the point.
        }
        if (isClientError(error))
            return;
        try {
            onServerError(error);
        }
        catch {
            // A reporter failure never changes what the person is told.
        }
    };
}
/** An `APIError` whose status is below 500: an answer the route meant to give. */
function isClientError(error) {
    if (!isAPIError(error))
        return false;
    const statusCode = error.statusCode;
    return typeof statusCode === "number" && statusCode < 500;
}
function logAsBetterAuthWould(error, logger) {
    const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : null;
    if (message !== null && /no column|column|relation|table|does not exist/.test(message)) {
        logger?.error(message);
        return;
    }
    if (isAPIError(error)) {
        const status = error.status;
        if (status === "INTERNAL_SERVER_ERROR")
            logger?.error(status, error);
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
export function createAuth(config) {
    const socialProviders = {};
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
                    before: async (session, ctx) => {
                        const path = ctx && typeof ctx.path === "string" ? ctx.path : "";
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
//# sourceMappingURL=server.js.map