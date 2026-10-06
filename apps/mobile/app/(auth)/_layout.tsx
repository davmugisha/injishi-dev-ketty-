/**
 * The signed-out stack. A group rather than three top-level routes so the auth
 * screens share one stack and the app can leave the shell entirely rather than
 * pushing a sheet over it.
 *
 * Headerless: frames X1, X2 and X3 each draw their own back control over a
 * full-bleed canvas, and a navigation header above that is a second back button
 * for the same move.
 *
 * `activate` is refused for everyone. It is the frame X3 prototype: it showed a
 * fixture invitation (the persona's name and email, a fixture lease) to anybody
 * opening `injishi://activate`, and its button opened the shell with no
 * credential (mobile audit 2026-10-05, SA-20). Real invitations open the web
 * `/activate`. It comes back when the tenant invitation is wired (scope
 * features 5 and 8); hidden rather than deleted until then.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={false}>
        <Stack.Screen name="activate" />
      </Stack.Protected>
    </Stack>
  );
}
