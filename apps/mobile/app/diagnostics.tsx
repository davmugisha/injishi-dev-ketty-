/**
 * `/diagnostics` — forced failures for proving crash reporting (ADR-063 AC-7).
 *
 * Registered inside `Stack.Protected` in `_layout.tsx`, and ALSO refused here:
 * a guarded screen is dropped from the navigator, but what a direct link to it
 * then shows is up to linking, and AC-7 asks for "not found" in a production
 * build, so this route says it itself.
 */
import { DIAGNOSTICS_ALLOWED } from '@/lib/crash-env';
import { DiagnosticsScreen } from '@/screens/account';
import NotFoundScreen from './+not-found';

export default function DiagnosticsRoute() {
  return DIAGNOSTICS_ALLOWED ? <DiagnosticsScreen /> : <NotFoundScreen />;
}
