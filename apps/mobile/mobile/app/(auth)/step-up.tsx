/**
 * The emailed step-up (F-S02), ADR-038 child 0 task 10.
 *
 * It sits in `(auth)` rather than beside the operator surfaces because it is
 * the same kind of screen as verify-otp — a code, a countdown, a resend — and
 * because the shell's signed-out redirect already leaves this group alone.
 *
 * Reached from the gate in `app/_layout.tsx`, which reads `twoFactor` off the
 * `/me/workspaces` answer and sends an operator here BEFORE their surface
 * renders rather than after a 403.
 */
import { StepUpScreen } from '@/screens/auth/step-up';

export default function StepUpRoute() {
  return <StepUpScreen />;
}
