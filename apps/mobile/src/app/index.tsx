import { homeHref } from "@injishi/data";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";

/** Start: the signed-in person's app, or the sign-in screen, once the stored session has been checked. */
export default function Index() {
  const { status, persona } = useSession();
  if (status === "loading") return null;
  return <Redirect href={(persona ? homeHref(persona.id) : "/sign-in") as never} />;
}
