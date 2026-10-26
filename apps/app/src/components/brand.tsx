// heroui-ok: image-only brand marks (no interactive UI).
import NextImage from "next/image";

/** The Injishi mark (artifact logo). Decorative next to the "Injishi" wordmark. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return <NextImage src="/brand/injishi-mark.png" alt="" width={size} height={size} className={className} priority />;
}

/** The green palm logo from the brand kit (doc/logo_injishi-short.svg). */
export function BrandPalm({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <NextImage
      src="/brand/injishi-short.svg"
      alt=""
      width={Math.round(size * (431 / 384))}
      height={size}
      className={className}
    />
  );
}
