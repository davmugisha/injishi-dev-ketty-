"use client";

/**
 * One workspace's screens, when one of them throws.
 *
 * The same wording as the app-wide boundary, mounted a layer down on purpose:
 * this one sits INSIDE the workspace layout, so the operator keeps the sidebar,
 * the topbar and the workspace they were in, and the failure is scoped to the
 * screen that failed rather than swallowing the whole app.
 *
 * The root boundary stays for anything that breaks above this — the providers,
 * the store, the workspace resolver itself.
 */

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@injishi/ui";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = typeof params.workspaceId === "string" ? params.workspaceId : "";

  useEffect(() => {
    console.error("operator app: workspace screen failed to render", error);
  }, [error]);

  return (
    <div className="pms-enter" style={{ minHeight: "50vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: "44ch", textAlign: "center" }}>
        <h1 className="pms-display" style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)" }}>
          This screen stopped short
        </h1>
        <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: "var(--muted)" }}>
          Something went wrong on our side while drawing it. Your work is safe and nothing
          was changed — opening it again is usually enough.
        </p>

        <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          <Button size="sm" shape="rounded" onClick={reset}>
            Try this screen again
          </Button>
          {/* The bare workspace address, which opens whatever that workspace
              opens on — a hotel on Today, a landlord on the rent roll. Naming
              one screen here would send half the operators somewhere they do
              not work. */}
          {workspaceId ? (
            <Button asChild variant="outline" size="sm" shape="rounded">
              <Link href={`/w/${workspaceId}`}>Back to your workspace</Link>
            </Button>
          ) : null}
        </div>

        {error.digest ? (
          <p className="pms-num" style={{ marginTop: 14, fontSize: 12, color: "var(--faint)" }}>
            Reference for support: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
