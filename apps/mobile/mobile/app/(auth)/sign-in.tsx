/**
 * Sign in - frame X1. Phone-first: an RW +250 prefix segment, a nine-digit
 * number, an SMS code, and Google beside it.
 *
 * **Decision D2 is a live conflict and this screen is where it lands.** F-S01
 * and the built Better Auth server are EMAIL OTP; the prototype draws PHONE
 * OTP. The prototype wins for the walkthrough, the server does not change, and
 * `/architect` settles it before any Phase 3 wiring. The full statement of the
 * conflict, and what it costs to reverse, is at the top of the screen itself.
 */
import { SignInScreen } from '@/screens/auth/sign-in';

export default function SignInRoute() {
  return <SignInScreen />;
}
