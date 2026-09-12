/**
 * Verify code - frame X2. Six boxes, an auto-submit at six digits, and a
 * resend that counts down before it becomes a link.
 *
 * Takes the address as an `email` route param, holding the string the person
 * typed — trimmed, but NOT lowercased, so the screen can print back exactly
 * what they wrote and a typo stays visible to them. Reached with none, it sends
 * the reader back to `(auth)/sign-in`, which is the screen that collects one.
 */
import { VerifyOtpScreen } from '@/screens/auth/verify-otp';

export default function VerifyOtpRoute() {
  return <VerifyOtpScreen />;
}
