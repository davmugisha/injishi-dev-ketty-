/**
 * The signed-out stack. A group rather than three top-level routes so the auth
 * screens share one stack and the app can leave the shell entirely rather than
 * pushing a sheet over it.
 *
 * Headerless: frames X1, X2 and X3 each draw their own back control over a
 * full-bleed canvas, and a navigation header above that is a second back button
 * for the same move.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
