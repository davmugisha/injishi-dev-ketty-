import { usePathname } from "expo-router";
import { isMock } from "@/lib/data-mode";
import { useSession } from "@/lib/session";
import { personaApp } from "./guard-rules";
import { type AppKey, surfaceOf } from "./screens";
import { useProtoSession } from "./session";

/**
 * The app the current screen is inside, from the path (`/desk/me/account` is desk), for a shared screen
 * that must keep its app's tab bar: `router.push(href("shared-help", undefined, { app: useSurface() }))`.
 * On a root path (`/switcher`, `/sign-in`) it falls back to whose app this is: the sample data role in
 * mock mode, the signed in person's app in api mode, else the guest app.
 */
export function useSurface(): AppKey {
  const fromPath = surfaceOf(usePathname());
  const { role } = useProtoSession();
  const { persona } = useSession();
  if (fromPath) return fromPath;
  if (isMock) return role ?? "guest";
  return persona ? personaApp(persona.id) : "guest";
}
