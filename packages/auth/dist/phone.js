/**
 * Phone sign in (ADR-039). One Injishi-owned Better Auth plugin that owns the
 * whole phone journey, on one table, behind the SMS adapter seam.
 *
 * WHY THIS IS OURS AND NOT BETTER AUTH'S. Their `phone-number` plugin signs a
 * person in on a number ALONE and invents a placeholder email when it has to
 * create the account. This platform may never hold an account with no real
 * email: the emailed step-up is what guards every operator and officer route,
 * so an account with no mailbox would have no step-up channel at all, and a
 * stolen SIM would reach a hotel's money. A number here is a FRONT DOOR that
 * must be joined to a real email address before any account exists. The
 * reasoning and the three alternatives are in the ADR's rationale.
 *
 * WHAT IS BUILT HERE SO FAR. `send-code` and `verify`, which is the tracer
 * bullet: one number, one mock SMS, one code, one session. `verify` on a number
 * no account holds proves the phone and hands back a link token, and the join
 * endpoints that spend that token (`claim-email`, `claim-verify`) plus `attach`
 * are the next slice. Until they exist, a person on an unknown number gets a
 * proved challenge and no account, which is exactly the state the join resumes
 * from.
 *
 * TWO RULES THAT MUST NOT BE RELAXED.
 *
 * `send-code` NEVER LOOKS A USER UP. Not once, on any path. That is what makes
 * AC-3 cheap to hold rather than delicate: there is no branch to leak and no
 * timing difference to mask, so a registered and an unregistered number get a
 * byte-identical answer without anybody having to remember to make them match.
 * The only endpoint that resolves a `users` row is `verify`, which by then
 * already holds a correct code.
 *
 * A CODE NEVER REACHES A LOG. Not on the happy path, not on a failure path, and
 * neither does a link token or a full phone number. The single written exception
 * is `MockSmsAdapter` on the API side, and it is made structurally unreachable
 * in production rather than switched off by configuration (AC-13).
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { normalizeRwPhone } from "@injishi/contracts";
import { APIError, createAuthEndpoint, createAuthMiddleware, getIp, sessionMiddleware, } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { IDENTIFIER_BUDGET, IP_BUDGET, OTP_BUDGET_MODEL, spendSendBudget, } from "./otp-budget.js";
import { OTP_EXPIRY_SECONDS, OTP_LENGTH, OTP_MAX_ATTEMPTS } from "./options.js";
/** The Better Auth model name for a phone sign in part way through. */
const CHALLENGE_MODEL = "phoneLinkChallenge";
/**
 * The Better Auth model name for `user_profiles`.
 *
 * Its `phone_e164` is a DISPLAY copy of `users.phone_number` and never a login
 * key (AC-10). This plugin is the only thing that writes it from a verified
 * number, and it writes and clears it beside every write and clear of the real
 * column.
 */
const PROFILE_MODEL = "userProfile";
/** SHA-256 hex. The same one-way step `two_factor_challenges` uses. */
function sha256(value) {
    return createHash("sha256").update(value).digest("hex");
}
/**
 * Compare two hex digests without letting the clock say how far they matched.
 *
 * `timingSafeEqual` needs equal lengths, and two SHA-256 digests always have
 * them, so a length mismatch here means the stored value is not a digest at all
 * and the only safe answer is no.
 */
function digestsMatch(a, b) {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length !== right.length || left.length === 0)
        return false;
    return timingSafeEqual(left, right);
}
/** A fresh numeric code, drawn from the CSPRNG and never from `Math.random`. */
function generateCode() {
    return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}
/**
 * A digest no code can ever produce.
 *
 * Used to retire a code that has been spent while the row lives on. Writing a
 * random digest rather than clearing the column keeps `code_hash` NOT NULL and
 * keeps the invariant that a stage change replaces the code, its expiry and its
 * attempt count together (invariant 6).
 */
function unreachableDigest() {
    return randomBytes(32).toString("hex");
}
function asDate(value) {
    return value instanceof Date ? value : new Date(value);
}
/** The body every failure returns: a code a client switches on, plus wording. */
function fail(status, code, message) {
    return new APIError(status, { code, message });
}
const NOT_RW_MESSAGE = "Injishi can only text Rwandan mobile numbers. Sign in with your email address instead.";
const RATE_LIMITED_MESSAGE = "Too many codes have been requested for this number. Sign in with your email address instead, or try again in an hour.";
const SMS_DOWN_MESSAGE = "We could not send the code just now. Try again, or sign in with your email address instead.";
const CODE_INVALID_MESSAGE = "That code is not right. Check it and try again.";
const CODE_EXPIRED_MESSAGE = "That code has expired. Ask for a new one.";
const ATTEMPTS_MESSAGE = "Too many wrong tries. Ask for a new code.";
const EMAIL_DOWN_MESSAGE = "We could not send the code to that email address just now. Try again in a moment.";
const LINK_TOKEN_MESSAGE = "That sign in has expired. Start again with your phone number.";
const EMAIL_RATE_LIMITED_MESSAGE = "Too many codes have been requested for that email address. Try again in an hour.";
/**
 * The phone half of the OTP send cap, split out so `send-code` reads as one
 * decision rather than two nested ones.
 *
 * The IP ceiling is asked FIRST. Refusing an attacker walking many numbers
 * before their target's own budget is touched is the whole point of having two
 * caps: otherwise walking numbers would spend a stranger's allowance as a side
 * effect, which is the denial of service the per-identifier cap exists to
 * prevent.
 */
async function mayspend(adapter, phone, ip) {
    if (ip) {
        const ipOk = await spendSendBudget(adapter, ip, "sms", IP_BUDGET);
        if (!ipOk)
            return false;
    }
    return spendSendBudget(adapter, phone, "sms", IDENTIFIER_BUDGET);
}
/**
 * Check the code currently outstanding on a challenge, and spend an attempt if
 * it is wrong.
 *
 * Shared by all three endpoints that verify a code, because the ORDER of these
 * checks is a contract and not a preference. Expiry is answered before the
 * comparison and with its own wording, so a person can tell "ask for a new one"
 * apart from "you typed it wrong" (AC-17); three copies of that order would be
 * three chances to get it wrong.
 *
 * Throws on every failure and returns nothing on success, so a caller cannot
 * forget to look at a result.
 */
async function spendAttempt(adapter, challenge, code, where, now) {
    if (asDate(challenge.expiresAt) <= now) {
        await adapter.delete({ model: CHALLENGE_MODEL, where });
        throw fail("BAD_REQUEST", "CODE_EXPIRED", CODE_EXPIRED_MESSAGE);
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
        await adapter.delete({ model: CHALLENGE_MODEL, where });
        throw fail("FORBIDDEN", "CODE_ATTEMPTS_EXHAUSTED", ATTEMPTS_MESSAGE);
    }
    if (digestsMatch(challenge.codeHash, sha256(code)))
        return;
    const attempts = challenge.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
        await adapter.delete({ model: CHALLENGE_MODEL, where });
        throw fail("FORBIDDEN", "CODE_ATTEMPTS_EXHAUSTED", ATTEMPTS_MESSAGE);
    }
    await adapter.update({
        model: CHALLENGE_MODEL,
        where,
        update: { attempts, updatedAt: now },
    });
    // How many guesses remain is never returned. A count is a map of how much
    // room a guesser has left.
    throw fail("BAD_REQUEST", "CODE_INVALID", CODE_INVALID_MESSAGE);
}
/**
 * Put a verified number on one account, taking it off whoever held it.
 *
 * MUST RUN INSIDE A TRANSACTION, and the caller is responsible for that.
 * `users_phone_number_uk` is unique, so clearing the loser and setting the
 * winner are two halves of one change: run them apart and a crash between them
 * either strands the number on nobody, or fails the second write and leaves a
 * person who has just been emailed "your number was removed" with no move to
 * show for it.
 *
 * Returns the losing account's email address, or null when nobody held the
 * number or when the holder was already this same account. The caller sends the
 * notice AFTER the transaction commits, because a notice for a move that then
 * rolls back is worse than a late one (AC-8, AC-20).
 *
 * `user_profiles.phone_e164` is written and cleared here too, beside every write
 * and every clear of `users.phone_number` (AC-10). It is a display copy and
 * never a login key: a value already sitting there is overwritten, never
 * promoted, because nobody ever proved it with a code.
 */
async function settlePhoneOnAccount(trx, phone, targetUserId, now) {
    const holder = await trx.findOne({
        model: "user",
        where: [{ field: "phoneNumber", value: phone }],
    });
    let losingEmail = null;
    if (holder && holder.id !== targetUserId) {
        await trx.update({
            model: "user",
            where: [{ field: "id", value: holder.id }],
            // Both columns move together. There is no path that sets one without the
            // other, which is invariant 2 read backwards.
            update: { phoneNumber: null, phoneNumberVerified: false, updatedAt: now },
        });
        await trx.update({
            model: PROFILE_MODEL,
            where: [{ field: "userId", value: holder.id }],
            update: { phoneE164: null, updatedAt: now },
        });
        losingEmail = holder.email;
    }
    await trx.update({
        model: "user",
        where: [{ field: "id", value: targetUserId }],
        update: { phoneNumber: phone, phoneNumberVerified: true, updatedAt: now },
    });
    /*
     * The profile row may not exist: nothing creates one when an account is made,
     * so a person who has never opened their profile has no row to update.
     * `update` answers null in that case rather than raising, which is what tells
     * the two paths apart.
     */
    const profile = await trx.update({
        model: PROFILE_MODEL,
        where: [{ field: "userId", value: targetUserId }],
        update: { phoneE164: phone, updatedAt: now },
    });
    if (!profile) {
        await trx.create({
            model: PROFILE_MODEL,
            data: { userId: targetUserId, phoneE164: phone },
        });
    }
    return losingEmail;
}
/**
 * The send cap, as a plugin of its own so it applies to EMAIL codes too.
 *
 * It is separate from `injishiPhone` because the two have different lifetimes:
 * a deployment with no SMS adapter still sends email codes and still has a
 * budget to protect, and F-S01 §9 asked for this on email long before phone sign
 * in existed. The ledger model is declared here, once, and `injishiPhone` reads
 * the same rows through the merged schema.
 *
 * It hooks the SEND paths rather than wrapping `sendVerificationOTP`, because
 * Better Auth may run that callback in the background, where a throw would never
 * reach the person and they would be told a code was sent that never was.
 */
export function otpSendCap() {
    return {
        id: "injishi-otp-send-cap",
        schema: {
            [OTP_BUDGET_MODEL]: {
                modelName: OTP_BUDGET_MODEL,
                fields: {
                    identifier: { type: "string", required: true, input: false },
                    channel: { type: "string", required: true, input: false },
                    windowStartedAt: { type: "date", required: true, input: false },
                    countHour: { type: "number", required: true, input: false },
                    dayStartedAt: { type: "date", required: true, input: false },
                    countDay: { type: "number", required: true, input: false },
                    lockedUntil: { type: "date", required: false, input: false },
                },
            },
        },
        hooks: {
            before: [
                {
                    // Every Better Auth path that spends an email send. Listed rather than
                    // matched by prefix, because `/email-otp/verify-email` and
                    // `/email-otp/check-verification-otp` sit under the same prefix and
                    // spend nothing — capping those would lock a person out of a code they
                    // already hold, which is the exact failure AC-12b forbids.
                    matcher: (ctx) => ctx.path === "/email-otp/send-verification-otp" ||
                        ctx.path === "/email-otp/request-password-reset" ||
                        ctx.path === "/email-otp/request-email-change" ||
                        ctx.path === "/forget-password/email-otp",
                    handler: createAuthMiddleware(async (ctx) => {
                        const body = (ctx.body ?? {});
                        const raw = typeof body.email === "string" ? body.email : body.newEmail;
                        // No address to key a budget on. Let the endpoint's own validation
                        // answer; refusing here would turn a malformed body into a rate
                        // limit, which reads as an account problem to the person.
                        if (typeof raw !== "string" || raw.trim() === "")
                            return;
                        // The same lowercased form `users_email_lower_uk` already keys on, so
                        // two spellings of one address cannot hold two budgets.
                        const identifier = raw.trim().toLowerCase();
                        const ip = ctx.request ? getIp(ctx.request, ctx.context.options) : null;
                        if (ip) {
                            const ipOk = await spendSendBudget(ctx.context.adapter, ip, "email", IP_BUDGET);
                            if (!ipOk) {
                                throw fail("TOO_MANY_REQUESTS", "RATE_LIMITED", "Too many codes have been requested from this connection. Try again in an hour.");
                            }
                        }
                        const ok = await spendSendBudget(ctx.context.adapter, identifier, "email", IDENTIFIER_BUDGET);
                        if (!ok) {
                            throw fail("TOO_MANY_REQUESTS", "RATE_LIMITED", "Too many codes have been requested for this email address. Try again in an hour.");
                        }
                    }),
                },
            ],
        },
    };
}
/**
 * The phone sign in plugin. Mounted under `AUTH_BASE_PATH`, so its endpoints are
 * `/api/auth/injishi-phone/*`.
 */
export function injishiPhone(options) {
    const { sendSms, sendEmailOtp, sendPhoneRemovedNotice } = options;
    return {
        id: "injishi-phone",
        schema: {
            user: {
                fields: {
                    /**
                     * A SECOND LOGIN KEY, never a display field. `input: false` on both
                     * columns is load bearing: it stops `/update-user` writing either one,
                     * so the only way a number reaches this row is through a verified code
                     * on this plugin's own endpoints (invariant 2).
                     */
                    phoneNumber: {
                        type: "string",
                        required: false,
                        unique: true,
                        input: false,
                        returned: true,
                    },
                    phoneNumberVerified: {
                        type: "boolean",
                        required: false,
                        input: false,
                        returned: true,
                    },
                },
            },
            [CHALLENGE_MODEL]: {
                modelName: CHALLENGE_MODEL,
                fields: {
                    phoneE164: { type: "string", required: true, input: false },
                    stage: { type: "string", required: true, input: false },
                    linkTokenHash: { type: "string", required: false, input: false },
                    email: { type: "string", required: false, input: false },
                    userId: { type: "string", required: false, input: false },
                    codeHash: { type: "string", required: true, input: false },
                    expiresAt: { type: "date", required: true, input: false },
                    attempts: { type: "number", required: true, input: false },
                },
            },
            /**
             * Declared so the adapter can reach `user_profiles`, and with ONLY the one
             * column this plugin touches.
             *
             * The table is much wider than this. Listing the rest would be this file
             * claiming ownership of a profile model it does not own, and every column
             * named here is a column a later schema change would have to keep in step
             * with two places instead of one.
             */
            [PROFILE_MODEL]: {
                modelName: PROFILE_MODEL,
                fields: {
                    userId: { type: "string", required: true, input: false },
                    phoneE164: { type: "string", required: false, input: false },
                },
            },
        },
        endpoints: {
            /**
             * POST `/api/auth/injishi-phone/send-code`
             *
             * Answers `{ sent: true }` for every well-formed Rwandan mobile number,
             * whether or not an account holds it, in body and in status code (AC-3).
             */
            injishiPhoneSendCode: createAuthEndpoint("/injishi-phone/send-code", { method: "POST" }, async (ctx) => {
                const body = (ctx.body ?? {});
                const phone = typeof body.phone === "string" ? normalizeRwPhone(body.phone) : null;
                if (!phone)
                    throw fail("BAD_REQUEST", "PHONE_NOT_RW", NOT_RW_MESSAGE);
                const adapter = ctx.context.adapter;
                const where = [{ field: "phoneE164", value: phone }];
                const existing = await adapter.findOne({
                    model: CHALLENGE_MODEL,
                    where,
                });
                /*
                 * AC-21. A journey past `sms_sent` is left completely alone: the link
                 * token already in the person's hands keeps working, no SMS is sent and
                 * no budget is spent. Asking for a code again mid-join is what a person
                 * does when a screen looks stuck, and destroying their half-finished
                 * join for it would send them back to the beginning.
                 *
                 * The answer is still the same uniform body, so this branch is
                 * invisible from outside.
                 */
                if (existing && existing.stage !== "sms_sent") {
                    return ctx.json({ sent: true });
                }
                const ip = ctx.request ? getIp(ctx.request, ctx.context.options) : null;
                const allowed = await mayspend(adapter, phone, ip);
                if (!allowed) {
                    throw fail("TOO_MANY_REQUESTS", "RATE_LIMITED", RATE_LIMITED_MESSAGE);
                }
                const code = generateCode();
                const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);
                const fresh = {
                    stage: "sms_sent",
                    linkTokenHash: null,
                    email: null,
                    userId: null,
                    codeHash: sha256(code),
                    expiresAt,
                    attempts: 0,
                };
                if (existing) {
                    await adapter.update({
                        model: CHALLENGE_MODEL,
                        where,
                        update: { ...fresh, updatedAt: new Date() },
                    });
                }
                else {
                    await adapter.create({
                        model: CHALLENGE_MODEL,
                        data: { phoneE164: phone, ...fresh },
                    });
                }
                try {
                    await sendSms({ phone, code });
                }
                catch {
                    /*
                     * AC-14. The CHALLENGE is rolled back so nothing was consumed; the
                     * BUDGET is not, because a send attempt is what costs.
                     *
                     * Restoring the row we replaced rather than deleting it matters: a
                     * person whose resend failed still holds the code from the send that
                     * worked, and deleting the row would silently kill a code they can
                     * read on their handset right now.
                     */
                    if (existing) {
                        await adapter.update({
                            model: CHALLENGE_MODEL,
                            where,
                            update: {
                                stage: existing.stage,
                                linkTokenHash: existing.linkTokenHash,
                                email: existing.email,
                                userId: existing.userId,
                                codeHash: existing.codeHash,
                                expiresAt: asDate(existing.expiresAt),
                                attempts: existing.attempts,
                                updatedAt: new Date(),
                            },
                        });
                    }
                    else {
                        await adapter.delete({ model: CHALLENGE_MODEL, where });
                    }
                    // The error is swallowed rather than re-raised: it carries the
                    // provider's own text, which has been seen to quote the message body,
                    // and the message body carries the code.
                    throw fail("SERVICE_UNAVAILABLE", "SMS_UNAVAILABLE", SMS_DOWN_MESSAGE);
                }
                return ctx.json({ sent: true });
            }),
            /**
             * POST `/api/auth/injishi-phone/verify`
             *
             * The only endpoint in this plugin that resolves a `users` row, and it does
             * so only once a correct code is in hand.
             */
            injishiPhoneVerify: createAuthEndpoint("/injishi-phone/verify", { method: "POST" }, async (ctx) => {
                const body = (ctx.body ?? {});
                const phone = typeof body.phone === "string" ? normalizeRwPhone(body.phone) : null;
                if (!phone)
                    throw fail("BAD_REQUEST", "PHONE_NOT_RW", NOT_RW_MESSAGE);
                const code = typeof body.code === "string" ? body.code.trim() : "";
                const adapter = ctx.context.adapter;
                const where = [{ field: "phoneE164", value: phone }];
                const challenge = await adapter.findOne({
                    model: CHALLENGE_MODEL,
                    where,
                });
                // No challenge, and a challenge that is past the SMS step, are the same
                // answer: there is no outstanding SMS code to check. Saying so any more
                // precisely would tell a stranger how far someone else's sign in got.
                if (!challenge || challenge.stage !== "sms_sent") {
                    throw fail("BAD_REQUEST", "CODE_INVALID", CODE_INVALID_MESSAGE);
                }
                const now = new Date();
                await spendAttempt(adapter, challenge, code, where, now);
                // The code is right. From here the number is proved.
                const user = await adapter.findOne({
                    model: "user",
                    where: [{ field: "phoneNumber", value: phone }],
                });
                if (user) {
                    // AC-4. An account already holds this number, so this is a sign in
                    // and nothing is created.
                    await adapter.delete({ model: CHALLENGE_MODEL, where });
                    const session = await ctx.context.internalAdapter.createSession(user.id, false);
                    if (!session) {
                        throw fail("SERVICE_UNAVAILABLE", "SMS_UNAVAILABLE", SMS_DOWN_MESSAGE);
                    }
                    // AC-11. Nothing here touches `sessions.two_factor_verified_at`, so a
                    // session born on a phone still owes the emailed step-up before any
                    // operator or officer route answers it.
                    await setSessionCookie(ctx, { session, user });
                    return ctx.json({ status: "signed-in" });
                }
                /*
                 * AC-5. Nobody holds this number. The phone is proved and the journey
                 * pauses here, holding a link token, so the join can carry that proof
                 * forward without a second SMS.
                 *
                 * The token is server state in this row rather than a self-contained
                 * signed value, because without a handle the only key into a pending
                 * challenge is the phone number itself — which would let anyone who
                 * knows a number race its real owner and attach their own email to it.
                 */
                const linkToken = randomBytes(32).toString("base64url");
                await adapter.update({
                    model: CHALLENGE_MODEL,
                    where,
                    update: {
                        stage: "phone_proved",
                        linkTokenHash: sha256(linkToken),
                        // The SMS code is spent. Its digest, expiry and attempt count are
                        // replaced together (invariant 6), so the code that just worked
                        // cannot be replayed while the row lives on.
                        codeHash: unreachableDigest(),
                        /*
                         * At this stage `expiresAt` is the LINK TOKEN's deadline, not a
                         * code's: no code is outstanding here, and the digest above is one
                         * nothing can produce.
                         *
                         * It has to be a real future moment rather than `now`. A proved
                         * phone with an expiry already in the past would be a row nothing
                         * could ever finish and nothing would ever tidy away, and the
                         * person holding the token would be told their journey is invalid
                         * the instant they typed their email address.
                         */
                        expiresAt: new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000),
                        attempts: 0,
                        updatedAt: now,
                    },
                });
                return ctx.json({ status: "email-required", linkToken });
            }),
            /**
             * POST `/api/auth/injishi-phone/claim-email`
             *
             * The person proved a number nobody holds and has now typed an email
             * address. This mails a second code to that address.
             *
             * Answers `{ sent: true }` whether or not the address already has an
             * account, in body and status code. That half of AC-3 is the reason the
             * account lookup happens on BOTH paths and only decides what to write, not
             * what to say.
             */
            injishiPhoneClaimEmail: createAuthEndpoint("/injishi-phone/claim-email", { method: "POST" }, async (ctx) => {
                const body = (ctx.body ?? {});
                const linkToken = typeof body.linkToken === "string" ? body.linkToken : "";
                const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
                if (!linkToken) {
                    throw fail("BAD_REQUEST", "LINK_TOKEN_INVALID", LINK_TOKEN_MESSAGE);
                }
                /*
                 * A malformed address is the ONE failure on this plugin with no member
                 * in the `PhoneErrorCode` set, so it answers with a plain Better Auth
                 * error rather than borrowing a code that means something else.
                 *
                 * That is defensible because no real client can reach it:
                 * `ClaimEmailRequest` in `@injishi/contracts` validates the address
                 * before the request is made, so an invalid one arriving here is a
                 * programming error and not a state a person can be in. Borrowing
                 * `LINK_TOKEN_INVALID` would send them back to the start of the
                 * journey over a typo. Recorded so a later decision can add a real
                 * code if a client ever needs to switch on this.
                 */
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
                    throw new APIError("BAD_REQUEST", {
                        code: "INVALID_EMAIL",
                        message: "Enter an email address we can send your code to.",
                    });
                }
                // The same lowercased form `users_email_lower_uk` keys on, so one
                // address can never become two accounts or two budgets.
                const email = rawEmail.toLowerCase();
                const adapter = ctx.context.adapter;
                const now = new Date();
                const challenge = await adapter.findOne({
                    model: CHALLENGE_MODEL,
                    where: [{ field: "linkTokenHash", value: sha256(linkToken) }],
                });
                // A journey still at `sms_sent` has not proved its phone yet, so it
                // holds no token and cannot be here. Anything else is a token that was
                // never issued, or one whose journey has been tidied away.
                if (!challenge || challenge.stage === "sms_sent") {
                    throw fail("BAD_REQUEST", "LINK_TOKEN_INVALID", LINK_TOKEN_MESSAGE);
                }
                if (asDate(challenge.expiresAt) <= now) {
                    await adapter.delete({
                        model: CHALLENGE_MODEL,
                        where: [{ field: "id", value: challenge.id }],
                    });
                    throw fail("BAD_REQUEST", "LINK_TOKEN_INVALID", LINK_TOKEN_MESSAGE);
                }
                const where = [{ field: "id", value: challenge.id }];
                /*
                 * Resolved on every path and never branched on for the answer. The
                 * result decides only whether `claim-verify` joins an existing account
                 * or makes a new one, which is a write, not a reply.
                 */
                const existing = await adapter.findOne({
                    model: "user",
                    where: [{ field: "email", value: email }],
                });
                const ip = ctx.request ? getIp(ctx.request, ctx.context.options) : null;
                if (ip) {
                    const ipOk = await spendSendBudget(adapter, ip, "email", IP_BUDGET);
                    if (!ipOk) {
                        throw fail("TOO_MANY_REQUESTS", "RATE_LIMITED", EMAIL_RATE_LIMITED_MESSAGE);
                    }
                }
                /*
                 * ONE budget per address, covering an ordinary email sign in code and
                 * this join code alike. Two budgets on one address would be two rules
                 * to explain and two places to get wrong, and a person is not less of a
                 * spender because they arrived by a different screen.
                 */
                const allowed = await spendSendBudget(adapter, email, "email", IDENTIFIER_BUDGET);
                if (!allowed) {
                    throw fail("TOO_MANY_REQUESTS", "RATE_LIMITED", EMAIL_RATE_LIMITED_MESSAGE);
                }
                const code = generateCode();
                await adapter.update({
                    model: CHALLENGE_MODEL,
                    where,
                    update: {
                        stage: "email_sent",
                        email,
                        userId: existing ? existing.id : null,
                        // The stage changed, so the digest, the expiry and the attempt
                        // count are all replaced together (invariant 6). This is what stops
                        // wrong SMS guesses quietly spending the email code's budget.
                        codeHash: sha256(code),
                        expiresAt: new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000),
                        attempts: 0,
                        updatedAt: now,
                    },
                });
                try {
                    await sendEmailOtp({ email, otp: code, type: "sign-in" });
                }
                catch {
                    // AC-20, the email twin of AC-14. The CHALLENGE goes back to where it
                    // was, so nothing was consumed and the link token still works; the
                    // BUDGET does not, because a send attempt is what costs.
                    await adapter.update({
                        model: CHALLENGE_MODEL,
                        where,
                        update: {
                            stage: challenge.stage,
                            email: challenge.email,
                            userId: challenge.userId,
                            codeHash: challenge.codeHash,
                            expiresAt: asDate(challenge.expiresAt),
                            attempts: challenge.attempts,
                            updatedAt: now,
                        },
                    });
                    throw fail("SERVICE_UNAVAILABLE", "EMAIL_UNAVAILABLE", EMAIL_DOWN_MESSAGE);
                }
                return ctx.json({ sent: true });
            }),
            /**
             * POST `/api/auth/injishi-phone/claim-verify`
             *
             * The last step of the join. Both keys are proved by here — the phone by
             * `verify` and the email by the code this checks — so this is where an
             * account is made or joined, and the only place a number moves between
             * accounts.
             */
            injishiPhoneClaimVerify: createAuthEndpoint("/injishi-phone/claim-verify", { method: "POST" }, async (ctx) => {
                const body = (ctx.body ?? {});
                const linkToken = typeof body.linkToken === "string" ? body.linkToken : "";
                const code = typeof body.code === "string" ? body.code.trim() : "";
                if (!linkToken) {
                    throw fail("BAD_REQUEST", "LINK_TOKEN_INVALID", LINK_TOKEN_MESSAGE);
                }
                const adapter = ctx.context.adapter;
                const now = new Date();
                const challenge = await adapter.findOne({
                    model: CHALLENGE_MODEL,
                    where: [{ field: "linkTokenHash", value: sha256(linkToken) }],
                });
                // Only `email_sent` has an emailed code outstanding. A journey still at
                // `phone_proved` has not been given an address yet.
                if (!challenge || challenge.stage !== "email_sent" || !challenge.email) {
                    throw fail("BAD_REQUEST", "LINK_TOKEN_INVALID", LINK_TOKEN_MESSAGE);
                }
                const where = [{ field: "id", value: challenge.id }];
                await spendAttempt(adapter, challenge, code, where, now);
                const email = challenge.email;
                const phone = challenge.phoneE164;
                const { userId, losingEmail } = await adapter.transaction(async (trx) => {
                    let targetId = challenge.userId;
                    if (!targetId) {
                        /*
                         * AC-6. Exactly one new account, holding the verified email and,
                         * a moment later in this same transaction, the verified phone.
                         *
                         * `emailVerified` is true because a code just proved the address,
                         * which is the same proof the email sign in path accepts. `name`
                         * and `image` are left null: nothing in this flow collects either,
                         * and inventing a name from a phone number is exactly what Better
                         * Auth's own plugin does and what ADR-039 rejects.
                         *
                         * Written through the transaction adapter rather than
                         * `internalAdapter.createUser`, because a user created outside this
                         * transaction would survive a rollback of the phone write and leave
                         * an account nobody asked for.
                         */
                        const created = await trx.create({
                            model: "user",
                            data: { email, emailVerified: true },
                        });
                        targetId = created.id;
                    }
                    const losing = await settlePhoneOnAccount(trx, phone, targetId, now);
                    await trx.delete({ model: CHALLENGE_MODEL, where });
                    return { userId: targetId, losingEmail: losing };
                });
                /*
                 * AC-8 and AC-20. Sent AFTER the commit, and its failure is swallowed
                 * rather than raised: the move has already happened, so a throw here
                 * would tell the person their sign in failed while their number has in
                 * fact changed hands. A notice is a notification, not a step.
                 */
                if (losingEmail) {
                    try {
                        await sendPhoneRemovedNotice({ email: losingEmail });
                    }
                    catch {
                        ctx.context.logger.error("phone-removed notice could not be sent; the move stands");
                    }
                }
                const user = await ctx.context.adapter.findOne({
                    model: "user",
                    where: [{ field: "id", value: userId }],
                });
                if (!user) {
                    throw fail("SERVICE_UNAVAILABLE", "EMAIL_UNAVAILABLE", EMAIL_DOWN_MESSAGE);
                }
                const session = await ctx.context.internalAdapter.createSession(user.id, false);
                // AC-11 again. Nothing here touches `two_factor_verified_at`, so an
                // account born on a phone still owes the emailed step-up before any
                // operator or officer route answers it.
                await setSessionCookie(ctx, { session, user });
                return ctx.json({ status: "signed-in" });
            }),
            /**
             * POST `/api/auth/injishi-phone/attach`
             *
             * A person who is already signed in adds a number to their own account.
             *
             * THE NUMBER COMES FROM THE BODY AND THE ACCOUNT FROM THE SESSION, never
             * both from the body, so this can only ever attach a phone to the caller.
             */
            injishiPhoneAttach: createAuthEndpoint("/injishi-phone/attach", { method: "POST", use: [sessionMiddleware] }, async (ctx) => {
                const body = (ctx.body ?? {});
                const phone = typeof body.phone === "string" ? normalizeRwPhone(body.phone) : null;
                if (!phone)
                    throw fail("BAD_REQUEST", "PHONE_NOT_RW", NOT_RW_MESSAGE);
                const code = typeof body.code === "string" ? body.code.trim() : "";
                const caller = ctx.context.session.user;
                const adapter = ctx.context.adapter;
                const now = new Date();
                const where = [{ field: "phoneE164", value: phone }];
                const challenge = await adapter.findOne({
                    model: CHALLENGE_MODEL,
                    where,
                });
                // The code came from `send-code`, the same public endpoint the
                // anonymous path uses, so the challenge is at `sms_sent` like any other.
                if (!challenge || challenge.stage !== "sms_sent") {
                    throw fail("BAD_REQUEST", "CODE_INVALID", CODE_INVALID_MESSAGE);
                }
                await spendAttempt(adapter, challenge, code, where, now);
                /*
                 * AC-9. This MOVES a number rather than refusing one, and there is no
                 * 409.
                 *
                 * A signed in person who also proves the phone holds strictly more
                 * proof than the anonymous join path, which is allowed to move it. So
                 * refusing here while allowing it there would be incoherent. The losing
                 * account is told either way.
                 */
                const losingEmail = await adapter.transaction(async (trx) => settlePhoneOnAccount(trx, phone, caller.id, now).then(async (losing) => {
                    await trx.delete({ model: CHALLENGE_MODEL, where });
                    return losing;
                }));
                if (losingEmail) {
                    try {
                        await sendPhoneRemovedNotice({ email: losingEmail });
                    }
                    catch {
                        ctx.context.logger.error("phone-removed notice could not be sent; the move stands");
                    }
                }
                return ctx.json({ status: losingEmail ? "moved" : "attached" });
            }),
        },
    };
}
//# sourceMappingURL=phone.js.map