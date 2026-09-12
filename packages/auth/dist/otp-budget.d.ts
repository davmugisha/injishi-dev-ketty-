/** Which side of the budget a send is spent on. Mirrors the `otp_channel` enum. */
export type OtpChannel = "sms" | "email";
/**
 * The Better Auth model name for the cap ledger.
 *
 * The drizzle adapter runs with `usePlural`, so this resolves to the
 * `authOtpRequests` export in the API's schema, which is the
 * `auth_otp_requests` table.
 */
export declare const OTP_BUDGET_MODEL = "authOtpRequest";
/** The two ceilings one identifier faces on one channel. */
export interface OtpBudgetLimits {
    maxHour: number;
    maxDay: number;
}
/** What one identifier may spend per hour and per day. */
export declare const IDENTIFIER_BUDGET: OtpBudgetLimits;
/**
 * What one calling IP address may spend per hour.
 *
 * There is deliberately no daily figure. The per-identifier cap alone does not
 * stop one attacker walking many numbers cheaply, and Rwandan mobile numbers sit
 * in a space small enough to walk; an hourly ceiling is what answers that. A
 * daily one would also punish a whole office or a mobile carrier NAT sharing one
 * address, which is a real shape here and not an attack.
 */
export declare const IP_BUDGET: OtpBudgetLimits;
/**
 * One clause of a Better Auth `where`, in the shape its adapter accepts.
 *
 * Restated here rather than imported so this module depends on the adapter's
 * SHAPE and not on a library type path, which is what keeps the emitted
 * declarations portable across the workspace (the same TS2742 reason
 * `AuthInstance` is spelled out in `server.ts`).
 */
type BudgetWhere = {
    field: string;
    value: string | number | boolean | Date | string[] | number[] | null;
};
/** The narrow adapter surface this module needs. */
interface BudgetAdapter {
    findOne: <T>(data: {
        model: string;
        where: BudgetWhere[];
        select?: string[] | undefined;
    }) => Promise<T | null>;
    create: <T extends Record<string, any>, R = T>(data: {
        model: string;
        data: Omit<T, "id">;
    }) => Promise<R>;
    update: <T>(data: {
        model: string;
        where: BudgetWhere[];
        update: Record<string, any>;
    }) => Promise<T | null>;
}
/**
 * Ask for one send, and count it if it is allowed.
 *
 * Returns `true` when the caller may go on to send, `false` when the budget is
 * spent. It never throws for a spent budget: the caller decides what a refusal
 * looks like on its own endpoint, because "no code was sent" is worded very
 * differently on a sign-in box than in a support tool.
 *
 * NOT ATOMIC, and that is a considered choice. Two requests that arrive in the
 * same millisecond can both read the same count and both write it back, so the
 * true ceiling is the figure plus the number of in-flight requests. A spend cap
 * protects a budget, not a secret; a row lock on every sign-in attempt would buy
 * exactness nobody needs and add a contention point to the busiest public
 * endpoint the platform has.
 */
export declare function spendSendBudget(adapter: BudgetAdapter, identifier: string, channel: OtpChannel, limits: OtpBudgetLimits, now?: Date): Promise<boolean>;
export {};
//# sourceMappingURL=otp-budget.d.ts.map