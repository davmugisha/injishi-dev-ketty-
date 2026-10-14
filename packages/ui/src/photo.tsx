import NextImage from "next/image";

/** Shape of an entry in @injishi/data/media `stock`. */
export interface PhotoSource {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * A stock photo in place of an artifact image placeholder (.ij-photo).
 * `fill` makes it cover its positioned parent; otherwise it keeps the manifest's intrinsic size
 * and scales with CSS (pass a className with width/height and object-cover).
 */
export function Photo({
  image,
  alt,
  className,
  fill,
  sizes,
  priority,
}: {
  image: PhotoSource;
  alt?: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
}) {
  const common = {
    src: image.src,
    alt: alt ?? image.alt,
    className: `object-cover ${className ?? ""}`,
    sizes,
    priority,
  };
  return fill ? <NextImage {...common} fill /> : <NextImage {...common} width={image.width} height={image.height} />;
}
