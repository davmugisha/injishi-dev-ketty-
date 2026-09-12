/**
 * The OTP send cap (ADR-039, AC-12 and AC-12b).
 *
 * ONE budget shared by every channel that spends money to reach a person: the
 * SMS sign-in code and the emailed one both draw on it, keyed by identifier and
 * channel. This is what closes the hole `options.ts` has recorded since F-S01
 * §9 — nothing anywhere limited how many codes one address could ask for.
 *
 * READ THE NAME LITERALLY. This caps SENDS, never sign-in. `send-code` is a
 * public endpoint, so an identifier that could be *locked* would be a weapon:
 * anyone who knows a Rwandan mobile number could hold its owner's sign-in shut
 * for as long as they cared to, for free. So reaching the cap stops sends and
 * does nothing else. The person keeps their email route, keeps any session they
 * already hold, and is told plainly what happened (AC-12b).
 *
 * TWO FIXED WINDOWS, not a sliding log. Each carries the moment its window
 * opened, and each resets independently once its length has passed. Fixed
 * windows are cheaper and far easier to reason about than a log of send times,
 * and the small burst they allow at a window boundary is bounded by the daily
 * figure anyway.
 *
 * COUNTING HAPPENS BEFORE SENDING, and a failed send does NOT hand the count
 * back. A send attempt is what costs; refunding it would let anyone spend freely
 * against a provider having a bad day. The challenge row IS rolled back on a
 * failed send — that is the promise AC-14 makes, and it is about the challenge,
 * not about the budget.
 */
import { OTP_LOCK_SECONDS, OTP_MAX_PER_DAY, OTP_MAX_PER_HOUR, OTP_MAX_PER_IP_HOUR, } from "./options.js";
/**
 * The Better Auth model name for the cap ledger.
 *
 * The drizzle adapter runs with `usePlural`, so this resolves to the
 * `authOtpRequests` export in the API's schema, which is the
 * `auth_otp_requests` table.
 */
export const OTP_BUDGET_MODEL = "authOtpRequest";
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** What one identifier may spend per hour and per day. */
export const IDENTIFIER_BUDGET = {
    maxHour: OTP_MAX_PER_HOUR,
    maxDay: OTP_MAX_PER_DAY,
};
/**
 * What one calling IP address may spend per hour.
 *
 * There is deliberately no daily figure. The per-identifier cap alone does not
 * stop one attacker walking many numbers cheaply, and Rwandan mobile numbers sit
 * in a space small enough to walk; an hourly ceiling is what answers that. A
 * daily one would also punish a whole office or a mobile carrier NAT sharing one
 * address, which is a real shape here and not an attack.
 */
export const IP_BUDGET = {
    maxHour: OTP_MAX_PER_IP_HOUR,
    maxDay: Number.POSITIVE_INFINITY,
};
function asDate(value) {
    return value instanceof Date ? value : new Date(value);
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
export async function spendSendBudget(adapter, identifier, channel, limits, now = new Date()) {
    const where = [
        { field: "identifier", value: identifier },
        { field: "channel", value: channel },
    ];
    const existing = await adapter.findOne({
        model: OTP_BUDGET_MODEL,
        where,
    });
    // First send this identifier has ever asked for on this channel. A create can
    // still lose a race with another first send, because the unique index on
    // (identifier, channel) is the thing that decides; re-read and fall through to
    // the update path when it does.
    if (!existing) {
        try {
            await adapter.create({
                model: OTP_BUDGET_MODEL,
                data: {
                    identifier,
                    channel,
                    windowStartedAt: now,
                    countHour: 1,
                    dayStartedAt: now,
                    countDay: 1,
                    lockedUntil: null,
                },
            });
            return true;
        }
        catch {
            const raced = await adapter.findOne({
                model: OTP_BUDGET_MODEL,
                where,
            });
            if (!raced)
                return false;
            return applyToRow(adapter, where, raced, limits, now);
        }
    }
    return applyToRow(adapter, where, existing, limits, now);
}
async function applyToRow(adapter, where, row, limits, now) {
    // Sending already stopped for this identifier and the pause has not run out.
    // Nothing is counted: an attacker hammering a capped number must not be able
    // to push the pause further out by hammering it.
    if (row.lockedUntil !== null && asDate(row.lockedUntil) > now)
        return false;
    // Each window resets on its own clock, so an hour that has rolled over gives
    // the person their hourly allowance back without touching the daily one.
    const hourRolled = now.getTime() - asDate(row.windowStartedAt).getTime() >= HOUR_MS;
    const dayRolled = now.getTime() - asDate(row.dayStartedAt).getTime() >= DAY_MS;
    const windowStartedAt = hourRolled ? now : asDate(row.windowStartedAt);
    const dayStartedAt = dayRolled ? now : asDate(row.dayStartedAt);
    const countHour = hourRolled ? 0 : row.countHour;
    const countDay = dayRolled ? 0 : row.countDay;
    if (countHour >= limits.maxHour || countDay >= limits.maxDay) {
        // Stop sending for a while. `lockedUntil` is the name of a pause on SENDS
        // and never on the account — see the header, and AC-12b.
        await adapter.update({
            model: OTP_BUDGET_MODEL,
            where,
            update: {
                windowStartedAt,
                dayStartedAt,
                countHour,
                countDay,
                lockedUntil: new Date(now.getTime() + OTP_LOCK_SECONDS * 1000),
                updatedAt: now,
            },
        });
        return false;
    }
    await adapter.update({
        model: OTP_BUDGET_MODEL,
        where,
        update: {
            windowStartedAt,
            dayStartedAt,
            countHour: countHour + 1,
            countDay: countDay + 1,
            // Cleared rather than left standing: a pause that has run out and is not
            // cleared here would be re-read on every later send for no reason.
            lockedUntil: null,
            updatedAt: now,
        },
    });
    return true;
}
//# sourceMappingURL=otp-budget.js.map