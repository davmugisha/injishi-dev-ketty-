/**
 * Bare chrome: no header, no footer, no tab bar, nothing but the page.
 *
 * For a screen that IS its whole content. Today that is the downloads Coming
 * soon screen (mobile spec 0004, AC-7), which shows the two words and nothing
 * else, on purpose. A page that needs a way back to the site belongs in
 * `(site)`, not here.
 */
export default function BareLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>;
}
