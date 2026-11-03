import { type Href, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { isMock } from "@/lib/data-mode";
import { landingAfterSignIn } from "@/lib/return-path";
import { useSession } from "@/lib/session";
import { isBrowsing } from "@/lib/welcome";
import { personaApp } from "@/proto/guard-rules";
import { appHome } from "@/proto/screens";
import { useProtoSession } from "@/proto/session";

/** Signed out: Explore when Find a stay was chosen on this phone, else the welcome (mobile spec 0005, D-b). */
function signedOutStart(): Href {
  return isBrowsing() ? "/guest/explore" : "/welcome";
}

/** Sample data mode: signed in as an app's person, that app; else the welcome or Explore. */
function MockStart() {
  const { signedIn, role } = useProtoSession();
  return <Redirect href={signedIn && role ? appHome(role) : signedOutStart()} />;
}

/**
 * Api mode, once the stored session has been checked. Signed in: the step up when owed, else the screen
 * a guest asked to come back to before sign in (read once, mobile spec 0005, D-av), else the person's
 * own app. Signed out, or unreachable with no account: Explore or the welcome.
 */
function ApiStart() {
  const { status, persona, stepUpOwed, takePendingReturn } = useSession();
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (persona && stepUpOwed) {
      setTarget("/two-factor");
      return;
    }
    if (persona) {
      const app = personaApp(persona.id);
      // Read once and cleared either way: anyone but a guest goes home and the kept path is dropped.
      const landing = landingAfterSignIn({
        pending: takePendingReturn(),
        isGuest: app === "guest",
        home: appHome(app) as string,
      });
      setTarget(landing as Href);
      return;
    }
    setTarget(signedOutStart());
  }, [status, persona, stepUpOwed, takePendingReturn]);

  return target ? <Redirect href={target} /> : null;
}

/** Start: where this phone opens (proto-ui, PLAN.md "Mock session"). */
export default function Index() {
  return isMock ? <MockStart /> : <ApiStart />;
}
