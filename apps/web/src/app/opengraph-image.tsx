import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fixed } from "@injishi/design-tokens";
import { ImageResponse } from "next/og";

/**
 * The site's share card: what WhatsApp, Facebook, LinkedIn and X show for a
 * link to a page that has no picture of its own (`lib/share-metadata.ts`).
 *
 * Drawn once at build from the credited Lake Kivu photograph (Wikimedia
 * Commons, listed on `/legal/photo-credits`) under the brand ink, with the
 * promise in words. Colours come from the token package, resolved in
 * TypeScript the way `manifest.ts` does, because an image has no stylesheet.
 */
export const alt = "Injishi: stay anywhere in Rwanda";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const photo = await readFile(join(process.cwd(), "public/assets/rwanda-lake-kivu-960.jpg"));
  const src = `data:image/jpeg;base64,${photo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain elements, not next/image */}
        <img
          src={src}
          alt=""
          width={1200}
          height={630}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundColor: fixed.ink,
            opacity: 0.55,
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            width: "100%",
            height: "100%",
            padding: "64px 72px",
            color: fixed.white,
          }}
        >
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700, letterSpacing: 1 }}>Injishi</div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            Stay anywhere in Rwanda
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 32, lineHeight: 1.3, maxWidth: 940 }}>
            Verified guesthouses, lodges and apartments. Pay by mobile money, held in escrow.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
