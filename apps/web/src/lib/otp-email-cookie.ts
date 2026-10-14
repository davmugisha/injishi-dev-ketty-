/**
 * Where the sign-in address waits between "send me a code" and "enter it".
 *
 * It used to ride in the URL (`/verify-otp?email=…`), which put a guest's email
 * address in the address bar, the browser history, server and proxy logs, and
 * the Referer of anything the code page loads. An HTTP-only cookie carries it
 * across the one redirect instead and expires with the code (ten minutes), so
 * nothing outside this origin ever sees it.
 */
export const OTP_EMAIL_COOKIE = "injishi_otp_email";

/** A code lives ten minutes; the address it was sent to need not outlive it. */
export const OTP_EMAIL_COOKIE_MAX_AGE = 10 * 60;
