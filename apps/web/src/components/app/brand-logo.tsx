/**
 * The Injishi mark, linked home, in its light/dark pair.
 *
 * Two files rather than one theme-aware SVG because the captures shipped it that
 * way and the swap is a pure CSS `dark:` toggle — no JS, no flash, and it works
 * before hydration.
 *
 * `short` is the standalone monogram used by the auth panels; `extended` is the
 * wordmark used by the onboarding header. Height travels with the variant: the
 * two marks have different aspect ratios and were never interchangeable at one
 * height.
 *
 * The class strings are written out in full, never composed, because Tailwind
 * scans this file as source text (`@source "../components/app"`) and a template
 * literal would compile to nothing.
 */
export default function BrandLogo({ variant }: { variant: "short" | "extended" }) {
  if (variant === "extended") {
    return (
      <a href={"/"} aria-label={"Injishi — home"}>
        <img src={"/shared/img/injishi-extended.svg"} alt={"Injishi"} className={"h-7 w-auto dark:hidden"} />
        <img src={"/shared/img/injishi-extended-white.svg"} alt={"Injishi"} className={"hidden h-7 w-auto dark:block"} />
      </a>
    );
  }
  return (
    <a href={"/"} aria-label={"Injishi — home"}>
      <img src={"/shared/img/injishi-short.svg"} alt={"Injishi"} className={"h-11 w-auto dark:hidden"} />
      <img src={"/shared/img/injishi-short-white.svg"} alt={"Injishi"} className={"hidden h-11 w-auto dark:block"} />
    </a>
  );
}
