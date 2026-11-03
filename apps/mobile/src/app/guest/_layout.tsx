import { Redirect, Stack } from "expo-router";
import { useSession } from "@/lib/session";

/**
 * The guest side (mobile spec 0005, D-ah): open to everyone, signed in or not. Only a signed in staff
 * persona is sent away, to its own app through the start route, so a housekeeper never lands in the
 * guest shell by a stale link. Screens that need an account check it themselves.
 */
export default function GuestLayout() {
  const { status, persona } = useSession();
  if (status === "loading") return null;
  if (persona && !(persona.app.kind === "phone" && persona.app.app === "guest")) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
