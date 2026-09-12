import { type OtpType } from "./options.js";
/**
 * The shared OTP constants, re-exported for browser consumers.
 *
 * They live in options.ts, and the root entry (".") re-exports it — but the
 * root also re-exports server.ts, so importing a constant from "@injishi/auth"
 * in a client component drags the Better Auth server config, its Drizzle
 * adapter and their dependencies into the browser bundle. React is only an
 * optional peer here precisely so that never has to happen.
 *
 * Re-exporting from "./client" gives the frontends the one definition of the
 * OTP shape without that cost, so a code length or the demo code is never
 * retyped as a literal in an app.
 *
 * `AUTH_BASE_PATH` joined them for the same reason. A frontend that calls a
 * Better Auth route without the browser client — `apps/web`'s sign-in Server
 * Action does, because `createAuthClient` needs browser APIs — has to know
 * where Better Auth is mounted. Typing "/api/auth" into that file would give
 * the mount point a second owner, and the two would drift the first time it
 * moved.
 */
export { AUTH_BASE_PATH, DEMO_OTP_CODE, OTP_EXPIRY_SECONDS, OTP_LENGTH, OTP_MAX_ATTEMPTS, } from "./options.js";
export type { OtpType } from "./options.js";
/** Standard `{ data, error }` envelope Better Auth client methods resolve to. */
export interface AuthResult<T = unknown> {
    data: T | null;
    error: {
        message?: string;
        status?: number;
        code?: string;
    } | null;
}
/**
 * The client surface the Injishi frontends use. Declared explicitly (rather
 * than inferred from `createAuthClient`) to keep the emitted types portable
 * across the pnpm workspace (TS2742). Extend as more flows are wired.
 */
export interface InjishiAuthClient {
    signIn: {
        social: (opts: {
            provider: "google";
            callbackURL?: string;
            errorCallbackURL?: string;
        }) => Promise<AuthResult>;
        emailOtp: (opts: {
            email: string;
            otp: string;
        }) => Promise<AuthResult>;
    };
    emailOtp: {
        sendVerificationOtp: (opts: {
            email: string;
            type: OtpType;
        }) => Promise<AuthResult>;
    };
    signOut: () => Promise<AuthResult>;
    getSession: () => Promise<AuthResult>;
    useSession: () => {
        data: unknown;
        isPending: boolean;
        error: unknown;
    };
}
/**
 * Build a Better Auth react client pointed at the Injishi auth server.
 *
 * @param baseURL Origin of the auth server, e.g. http://localhost:8000.
 */
export declare function makeAuthClient(baseURL: string): InjishiAuthClient;
//# sourceMappingURL=client.d.ts.map