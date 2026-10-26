/**
 * Every sentence sign-in can say when something goes wrong. None of them is Better Auth's or Google's:
 * each says what happened and the next step. Shared by the Server Actions and the pages, because an
 * action that cannot render (sign in as a persona, the Google return) sends a CODE in `?error=` and the
 * page says it. A code, never a sentence: a sentence in a url is text anyone can put on this screen.
 */

export const SEND_ERRORS = {
  "invalid-email": "That doesn’t look like an email address.",
  "too-many": "Too many codes for this email. Wait an hour, or use the newest code we sent.",
  unavailable: "We couldn’t reach Injishi to send your code. Try again in a moment.",
} as const;

export const VERIFY_ERRORS = {
  "wrong-code": "That code didn’t match. Use the newest message we sent.",
  expired: "This code has expired. Go back and ask for a new one.",
  "too-many": "Too many wrong codes. Ask for a new code.",
  unavailable: "We couldn’t reach Injishi to check your code. Try again in a moment.",
} as const;

const PAGE_ERRORS: Record<string, string> = {
  ...SEND_ERRORS,
  google: "Google sign-in didn’t finish, so you’re not signed in. Try again, or use your email.",
  "google-unreachable": "We couldn’t reach Google sign-in just now. Try again, or use your email.",
  unreachable: "We couldn’t reach Injishi just now. Try again in a moment.",
};

/** The sentence for a `?error=` code on the sign-in page, or null for a code it does not know. */
export function signInErrorMessage(code: string | null | undefined): string | null {
  return code && Object.hasOwn(PAGE_ERRORS, code) ? PAGE_ERRORS[code] : null;
}
