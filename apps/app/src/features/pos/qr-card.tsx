"use client";

import { qrMatrix, qrSvgPath } from "./qr";

/** A QR code drawn as one crisp SVG path (prints sharp at any size), with the standard four-module quiet zone. */
export function QrCode({ value, size = 128, label }: { value: string; size?: number; label: string }) {
  const m = qrMatrix(value);
  const n = m.length + 8;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      className="block rounded-lg bg-white"
    >
      <rect width={n} height={n} fill="#ffffff" />
      <path d={qrSvgPath(m)} fill="#0f1a14" />
    </svg>
  );
}

/** The link a table's code opens: the floor of its outlet with that table chosen (staff sign in first). */
export function tableLink(origin: string, outletId: string, tableId: string): string {
  return `${origin}/pos/floor?outlet=${outletId}&table=${tableId}`;
}

/** A short code printed under each QR, for a device with no camera: the table and the last characters of its id. */
export function tableCode(label: string, tableId: string): string {
  return `${label.replace(/\s+/g, "").toUpperCase()}-${tableId.replace(/-/g, "").slice(-4).toUpperCase()}`;
}

/** Downloads the table's card as a PNG (venue, table, QR and the hint), drawn on a canvas at print resolution. */
export function downloadTablePng(venue: string, label: string, area: string, link: string, code: string) {
  const m = qrMatrix(link);
  const scale = 10;
  const qr = (m.length + 8) * scale;
  const w = qr + 120;
  const h = qr + 330;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#0b8442";
  g.fillRect(0, 0, w, 14);
  g.textAlign = "center";
  g.fillStyle = "#4b5563";
  g.font = "600 22px Inter, Arial, sans-serif";
  g.fillText(venue.toUpperCase(), w / 2, 64);
  g.fillStyle = "#0f1a14";
  g.font = "700 64px Inter, Arial, sans-serif";
  g.fillText(label, w / 2, 136);
  g.fillStyle = "#6b7280";
  g.font = "500 22px Inter, Arial, sans-serif";
  g.fillText(area, w / 2, 170);
  const top = 190;
  g.fillStyle = "#0f1a14";
  m.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) g.fillRect(60 + (x + 4) * scale, top + (y + 4) * scale, scale, scale);
    });
  });
  g.fillStyle = "#0f1a14";
  g.font = "600 24px Inter, Arial, sans-serif";
  g.fillText("Scan to open this table", w / 2, top + qr + 40);
  g.fillStyle = "#6b7280";
  g.font = "500 20px Inter, Arial, sans-serif";
  g.fillText(`Code ${code}`, w / 2, top + qr + 74);
  g.fillText("Injishi POS · staff phone or tablet", w / 2, top + qr + 104);
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = `table-${label.replace(/\W+/g, "-").toLowerCase()}-qr.png`;
  a.click();
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);

/**
 * Opens a print sheet of table cards (A4, three across) in a new window and prints it. Each card carries the venue,
 * the table, its area, the QR code and the short code, so a laminated card can sit on every table.
 */
export function printTableCards(
  venue: string,
  cards: { label: string; area: string; link: string; code: string; seats: number }[],
) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return false;
  const body = cards
    .map((c) => {
      const m = qrMatrix(c.link);
      const n = m.length + 8;
      return `<article><p class="v">${esc(venue)}</p><p class="t">${esc(c.label)}</p><p class="a">${esc(c.area)} · ${c.seats} seats</p><svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${qrSvgPath(m)}" fill="#0f1a14"/></svg><p class="s">Scan to open this table</p><p class="c">Code ${esc(c.code)}</p></article>`;
    })
    .join("");
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(venue)} · table QR cards</title><style>@page{size:A4;margin:12mm}body{margin:0;font-family:Inter,Arial,sans-serif;color:#0f1a14}main{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm}article{break-inside:avoid;border:1px solid #e5e7eb;border-top:4px solid #0b8442;border-radius:14px;padding:14px 10px 12px;text-align:center}p{margin:0}.v{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#4b5563;font-weight:600}.t{font-size:30px;font-weight:700;margin-top:4px}.a{font-size:11px;color:#6b7280;margin-bottom:6px}svg{width:46mm;height:46mm}.s{font-size:12px;font-weight:600;margin-top:4px}.c{font-size:10px;color:#6b7280;margin-top:2px;letter-spacing:.04em}</style></head><body><main>${body}</main><script>window.onload=function(){setTimeout(function(){window.print()},300)}</script></body></html>`,
  );
  win.document.close();
  return true;
}
