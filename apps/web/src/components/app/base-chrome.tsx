import ThemeBoot from "@/components/app/theme-boot";
import ThemeToggle from "@/components/app/theme-toggle";
import AppBehaviors from "@/components/app/app-behaviors";
import RegisterServiceWorker from "@/components/app/register-service-worker";

/**
 * The chrome every Injishi-styled route group mounts at the top of <body>.
 *
 * (auth) and (onboarding) each carried this identical block, which is one of
 * the three drifts ADR-021 closed by merging them into (app): there is one
 * signed-in root layout now, so there is one mount site. It stays a Server
 * Component, exactly as the layouts were, so nothing moves into the client
 * bundle: the behaviour components below own their own "use client" boundary
 * and <ThemeBoot/> is a raw pre-paint <Script>.
 *
 * Order is load-bearing and preserved verbatim: ThemeBoot runs before
 * ThemeToggle so the pre-paint value is stamped before the listener that
 * changes it is attached.
 *
 * Lives under components/app/ because that is what `_injishi-app.css` scans
 * (`@source "../components/app"`). A component holding Tailwind classes outside
 * that list compiles to nothing.
 *
 * FONTS ARE NOT HERE ANY MORE (ADR-017 slice 1). This used to render
 * <link href="/shared/css/injishi-fonts.css">, which is a second stylesheet
 * request on every page that mounted it. The groups moved to `next/font/local`
 * instead, so the link would be pure duplication and would break ADR-017's
 * two-sheet ceiling.
 *
 * (onboarding) was the last holdout and kept rendering the link itself. ADR-021
 * merged that group into (app), and the link died with the layout that carried
 * it, which closes ADR-017's last open case: there is now ZERO
 * <link rel="stylesheet"> under src/app. Both consumers left — (app) and
 * (marketplace) — set the two brand faces on <html> in their own root layout.
 * Do not add the link back here.
 */
export default function BaseChrome() {
  return (
    <>
      <ThemeBoot />
      <ThemeToggle />
      <AppBehaviors />
      <RegisterServiceWorker />
    </>
  );
}
