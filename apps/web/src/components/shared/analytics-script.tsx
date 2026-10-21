import Script from "next/script";

import { ANALYTICS_DOMAIN, ANALYTICS_SRC } from "@/lib/analytics";

/**
 * The visit counter's script (`lib/analytics.ts`), mounted by both root
 * layouts so the funnel from a marketplace page into `/register` and
 * `/sign-in` is one journey. Renders nothing when analytics is off.
 *
 * The inline stub queues any `track()` call made before the script arrives;
 * the script drains the queue when it loads. It is Plausible's own snippet.
 */
export function AnalyticsScript() {
  if (!ANALYTICS_DOMAIN) return null;
  return (
    <>
      <Script id="analytics-queue" strategy="afterInteractive">
        {"window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}"}
      </Script>
      <Script src={ANALYTICS_SRC} data-domain={ANALYTICS_DOMAIN} strategy="afterInteractive" />
    </>
  );
}
