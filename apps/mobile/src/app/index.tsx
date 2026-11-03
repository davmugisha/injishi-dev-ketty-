import { homeHref } from "@injishi/data";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { landingAfterSignIn } from "@/lib/return-path";
import { useSession } from "@/lib/session";
import { isBrowsing } from "@/lib/welcome";

/**
 * Start, once the stored session has been checked. Signed in: the step up when owed, else the screen a
 * guest asked to come back to before sign in (read once, mobile spec 0005, D-av), else the person's own
 * app. Signed out, or unreachable with no account: Explore when Find a stay was chosen on this phone,
 * else the welcome (D-b).
 */
export default function Index() {
  const { status, persona, stepUpOwed, takePendingReturn } = useSession();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (persona && stepUpOwed) {
      setTarget("/two-factor");
      return;
    }
    if (persona) {
      const isGuest = persona.app.kind === "phone" && persona.app.app === "guest";
      // Read once and cleared either way: a staff persona goes home and the kept path is dropped.
      setTarget(landingAfterSignIn({ pending: takePendingReturn(), isGuest, home: homeHref(persona.id) }));
      return;
    }
    setTarget(isBrowsing() ? "/guest/explore" : "/welcome");
  }, [status, persona, stepUpOwed, takePendingReturn]);

  return target ? <Redirect href={target as never} /> : null;
}
