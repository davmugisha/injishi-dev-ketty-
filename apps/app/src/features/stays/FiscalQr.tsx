/**
 * QR-style visual of a signed fiscal receipt (artifact: the ij-photo placeholder on an issued receipt).
 * The modules are derived from the receipt number so every receipt draws its own pattern; the
 * receipt number is printed under it, the way the VSDC receipt shows it.
 * heroui-ok: a decorative SVG drawing; HeroUI has no QR component.
 */
const SIZE = 21;

function modules(code: string): string {
  let seed = 0;
  for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const next = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed >>> 16) & 1;
  };
  const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= SIZE - 8 && y < 8) || (x < 8 && y >= SIZE - 8);
  let d = "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (inFinder(x, y)) continue;
      if (next()) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  for (const [ox, oy] of [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
  ]) {
    d += `M${ox} ${oy}h7v7h-7zM${ox + 1} ${oy + 1}v5h5v-5zM${ox + 2} ${oy + 2}h3v3h-3z`;
  }
  return d;
}

export function FiscalQr({ code }: { code: string }) {
  return (
    <div
      role="img"
      aria-label={`Fiscal receipt QR code for ${code}`}
      className="flex w-[96px] shrink-0 flex-col items-center gap-1 rounded-xl border border-separator bg-surface p-2"
    >
      <svg viewBox={`-1 -1 ${SIZE + 2} ${SIZE + 2}`} className="size-[72px] text-foreground" aria-hidden="true">
        <path d={modules(code)} fill="currentColor" fillRule="evenodd" shapeRendering="crispEdges" />
      </svg>
      <span aria-hidden="true" className="text-[10px] leading-3 text-muted tabular">
        {code}
      </span>
    </div>
  );
}
