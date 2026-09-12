import Link from "next/link";

/**
 * The one answer for an address that names nothing (ADR-017, D-c).
 *
 * A workspace id the caller does not hold, an id that is not an id at all, and
 * a screen that does not exist all land here and all read the same. That is
 * deliberate: telling "not yours" apart from "not real" tells a stranger which
 * ids are real.
 *
 * Server rendered and free of app chrome, because the chrome is a workspace's
 * chrome and this page has no workspace.
 *
 * TWO THINGS THIS SCREEN GOT WRONG, and both are visible to an operator:
 *
 *  - It painted itself with `var(--bg)` and `var(--fg)`, which this app does
 *    not define — the tokens are `--background` and `--foreground`. Both fell
 *    back to nothing, so the page rendered on whatever the browser's default
 *    ground happened to be, in whatever the inherited colour was.
 *  - It opened with "The address may be mistyped", which blames the reader for
 *    a link they very likely did not type. A reservation older than the desk's
 *    90-day window lands here from a link inside this app; so does a record on
 *    a workspace somebody's role no longer covers. The wording names what is
 *    true of all of them without pointing at anybody.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div style={{ maxWidth: "42ch", textAlign: "center" }}>
        <p style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
          That page isn&apos;t here
        </p>
        <p style={{ marginTop: 10, fontSize: "0.9rem", lineHeight: 1.55, opacity: 0.72 }}>
          It isn&apos;t here any more, or it belongs to a workspace this account
          doesn&apos;t hold. Older bookings drop off the desk after 90 days — they are
          still on file, just not at this address.
        </p>
        <Link href="/" style={{ display: "inline-block", marginTop: 16, fontSize: "0.9rem", fontWeight: 600 }}>
          Back to your workspace
        </Link>
      </div>
    </main>
  );
}
