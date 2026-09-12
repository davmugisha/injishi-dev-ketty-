import { encodeQr } from "./qr-encode";

/**
 * The clause 7.24.7 QR code, as an inline SVG.
 *
 * SVG rather than a canvas or a PNG for one reason that outranks the others:
 * this has to PRINT. A canvas is a raster at whatever device pixel ratio the
 * screen happened to have, so a 120px symbol printed at 300dpi is a blur with
 * soft module edges — and a scanner reading a fiscal receipt off paper is the
 * whole point of the code. An SVG is resolution independent and the printer
 * rasterises it at its own resolution.
 *
 * One `<path>` of filled squares rather than one `<rect>` per module: a version
 * 5 symbol has 1369 modules, and 1369 elements is a lot of DOM for a picture
 * that never changes.
 *
 * No hooks, so this renders on a server as happily as in a browser. Encoding is
 * a pure function over a string the receipt already carries; memoising it would
 * buy a fraction of a millisecond and cost the component its portability.
 */

/** Modules of light border a QR symbol requires on every side (ISO/IEC 18004). */
const QUIET_ZONE = 4;

export interface QrCodeProps {
  /** The exact string to encode. Never re-derive it here; see `sdc.qrData`. */
  value: string;
  /** Rendered edge length in CSS pixels. The symbol scales to fill it. */
  size: number;
  /**
   * What a screen reader should say. A QR code is a picture of a string, and a
   * blind reader gets nothing from the string itself — they need to know what
   * the picture is FOR. The payload is printed in words elsewhere on the
   * receipt, which is where it belongs for a reader rather than a scanner.
   */
  label: string;
}

export function QrCode({ value, size, label }: QrCodeProps) {
  const symbol = encodeQr(value);

  const span = symbol.size + QUIET_ZONE * 2;
  let path = "";
  for (let row = 0; row < symbol.size; row += 1) {
    for (let col = 0; col < symbol.size; col += 1) {
      if (symbol.modules[row][col] === 1) {
        path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      // `viewBox` in module units with a pixel size on the element: the browser
      // scales one to the other, so the symbol is crisp at any size and the
      // module grid stays exactly square.
      viewBox={`0 0 ${span} ${span}`}
      width={size}
      height={size}
      // `crispEdges` stops the renderer antialiasing module boundaries into
      // grey, which is what makes a small symbol read as mush to a scanner.
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/*
        The quiet zone is INSIDE the viewBox and is PAINTED, never left
        transparent. A QR code on a transparent ground inherits whatever is
        behind it, and "whatever is behind it" is not guaranteed to be light: on
        a dark surface the symbol inverts and stops scanning.

        This is why the light is `--receipt-qr-light` and not `--receipt-paper`.
        The paper goes transparent when printing — correctly, so the printer's
        own sheet shows through — and a symbol that followed it would inherit
        that dependency everywhere the sheet is not white: a PDF rasterised onto
        a dark page, a receipt pasted onto a dark slide. Rasterising the print
        output onto black is exactly how the difference showed up, and the
        symbol failed to decode until the quiet zone stopped being borrowed.

        Both colours come from custom properties the paper sets, so no value is
        written here and neither can drift from the document around it.
      */}
      <rect width={span} height={span} fill="var(--receipt-qr-light)" />
      <path d={path} fill="var(--receipt-ink)" />
    </svg>
  );
}
