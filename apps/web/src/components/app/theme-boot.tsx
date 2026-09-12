import Script from "next/script";

/**
 * Pre-paint dark-mode bootstrap: resolves the theme and stamps <html> before
 * first paint, so there is no light-to-dark flash.
 *
 * This has to stay a raw inline script — it must run before the document
 * renders, which is earlier than any React component can execute. <ThemeToggle/>
 * takes over from here and owns every subsequent change.
 *
 * Resolution order: an explicit stored choice wins, otherwise LIGHT. The OS
 * preference is deliberately not consulted. It used to be, through
 * `matchMedia("(prefers-color-scheme: dark)")`, which made a visitor's first
 * paint depend on a setting they made for their whole machine rather than for
 * this product. Light is the brand's resting face, so light is what an unset
 * key resolves to.
 *
 * `components/layout/theme-provider.tsx` carries the matching half —
 * `defaultTheme="light"` with `enableSystem` off — and the two must move
 * together or the public layer and the signed-in groups disagree about what an
 * absent key means. `tests/theme-invariant.test.mjs` fails the build on either
 * half drifting.
 *
 * Both the `.dark` class and `data-theme` are set — the token layer keys off
 * `.dark`, and `data-theme` is what the toggle reads.
 */
export default function ThemeBoot() {
  return (
    <Script id="injishi-theme-boot" strategy="beforeInteractive">
      {`try{var s=localStorage.getItem('injishi-theme');` +
        `var d=s==='dark';` +
        `var r=document.documentElement;` +
        `r.classList.toggle('dark',d);r.setAttribute('data-theme',d?'dark':'light')}catch(e){}`}
    </Script>
  );
}
