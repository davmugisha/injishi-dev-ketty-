import { ArtDirectedImage } from "@/components/shared/art-directed-image";

/**
 * A photograph that fills its box, from the site's own licensed set
 * (`public/assets/sourced`, credited on /legal/photo-credits). Used across the
 * PSF pages.
 */
export function PsfPhoto({
  stem,
  alt,
  className,
  imgClassName,
  priority,
  square = false,
}: {
  stem: string;
  alt: string;
  className?: string;
  /** For the crop, e.g. `object-bottom` to keep a field rather than its sky. */
  imgClassName?: string;
  priority?: boolean;
  /** No rounded corners: for a photo that runs edge to edge. */
  square?: boolean;
}) {
  return (
    <div className={["overflow-hidden bg-border", square ? "" : "rounded-card", className].filter(Boolean).join(" ")}>
      <ArtDirectedImage
        stem={stem}
        alt={alt}
        sizes="(max-width: 1024px) 50vw, 25vw"
        width={960}
        height={720}
        priority={priority}
        pictureClassName="block h-full w-full"
        className={["h-full w-full", imgClassName].filter(Boolean).join(" ")}
      />
    </div>
  );
}
