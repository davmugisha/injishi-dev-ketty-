import { homeHref } from "@injishi/data";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/session";

/** Start: the signed-in person's app, or the sign-in screen. */
export default function Index() {
  const { persona } = useSession();
  return <Redirect href={(persona ? homeHref(persona.id) : "/sign-in") as never} />;
}
