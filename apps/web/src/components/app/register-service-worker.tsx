"use client";
import { useEffect, useState } from "react";
import { Button } from "@injishi/ui";

// Registers /sw.js in production only. When a new SW is waiting, surfaces a
// minimal reload prompt instead of silently swapping assets mid-session.
export default function RegisterServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((r) => {
        reg = r;
        if (r.waiting) setWaiting(r.waiting);
        r.addEventListener("updatefound", () => {
          const nw = r.installing;
          nw?.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(nw);
            }
          });
        });
      })
      .catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    return () => void reg;
  }, []);

  if (!waiting) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] mx-auto w-fit rounded bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">
      A new version is available.{" "}
      <Button
        variant="link"
        size="sm"
        className="ml-2 underline"
        onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
      >
        Reload
      </Button>
    </div>
  );
}
