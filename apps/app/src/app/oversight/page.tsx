"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { signInUrl, twoFactorUrl } from "@/pms/lib/sign-in-url";
import { fetchMyConsoles, type OfficerAccess } from "@/pms/oversight/data/me";
import { consoleHome } from "@/pms/oversight/lib/nav";

/**
 * Which console this officer opens.
 *
 * It asks the server rather than assuming, for the same reason the operator app
 * stopped assuming: the app used to open a fixed screen, so whoever arrived saw
 * a working console whether or not they held anything. An assignment is a row in
 * `oversight_assignments`, and only the server can read it.
 *
 * Holding both functions is legitimate and rare, and the first one listed opens.
 * The nav shows the other; there is nothing to choose between them here.
 *
 * `replace` rather than `push`, so Back leaves the app instead of bouncing off
 * this resolver forever.
 *
 * This is the only pms route outside `/w/[workspaceId]` that renders for someone
 * holding no workspace at all, which is why `providers.tsx` keeps
 * `WorkspaceBoundary` off this subtree (ADR-029).
 */
export default function Page() {
  const router = useRouter();
  const [access, setAccess] = useState<OfficerAccess>({
    status: "loading",
    consoles: [],
    twoFactor: null,
  });

  useEffect(() => {
    let live = true;
    void fetchMyConsoles().then((next) => {
      if (live) setAccess(next);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    // Only a RESOLVED answer names a door. `anonymous` goes to web's sign in,
    // the one door this app has had since ADR-029 folded the console into it;
    // `unreachable` says so rather than guessing.
    if (access.status === "anonymous") {
      window.location.replace(signInUrl(window.location.href));
      return;
    }
    if (access.status !== "resolved") return;
    // The emailed step-up first (F-S02), then the console.
    const factor = access.twoFactor;
    if (factor && factor.required && !factor.verified) {
      window.location.replace(twoFactorUrl(window.location.href));
      return;
    }
    const first = access.consoles[0];
    if (first) router.replace(consoleHome(first));
  }, [access, router]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div style={{ maxWidth: "38ch", textAlign: "center" }}>
        <p style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
          {access.status === "unreachable"
            ? "We can't reach the service"
            : access.status === "resolved" && access.consoles.length === 0
              ? "No console yet"
              : "Opening your console…"}
        </p>
        {access.status === "resolved" && access.consoles.length === 0 ? (
          <p style={{ marginTop: 10, fontSize: "0.9rem", lineHeight: 1.55, opacity: 0.72 }}>
            You&apos;re signed in, but you don&apos;t hold a government oversight
            assignment on this account.
          </p>
        ) : null}
      </div>
    </div>
  );
}
