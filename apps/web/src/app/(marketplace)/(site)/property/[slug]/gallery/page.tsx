import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { propertyMetadata, resolvePropertyPage } from "@/lib/property-route";

/**
 * The full-gallery route.
 *
 * The mosaic on the property page has linked here since it was built, and until
 * now the link went nowhere. It stays deliberately plain: a back link, the
 * property name, and the photographs at a size worth opening a gallery for.
 * Nothing competes with the pictures.
 *
 * It resolves the property exactly as the page does, API first and then the
 * catalogue, so a gallery can never answer for a property its page has stopped
 * serving. Revalidated on the same 30 second timer, for the same reason.
 */

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return propertyMetadata(params, (source) => ({
    title: `${source.property.name} photos`,
  }));
}

export default async function PropertyGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const source = await resolvePropertyPage(slug);
  if (!source) notFound();
  if (source.kind === "database") {
    return <DatabaseGallery name={source.property.name} photos={source.property.photos} slug={slug} />;
  }
  const property = source.property;

  return (
    <div className="bg-background">
      <div className="container flex max-w-wide flex-col gap-8 pb-24 pt-24 lg:pt-28">
        <div className="flex flex-col gap-2">
          <Link
            href={`/property/${property.slug}`}
            className="inline-flex w-max items-center gap-2 text-sm text-page-fg-70 underline underline-offset-4 transition-colors hover:text-page-fg"
          >
            <BackArrow />
            Back to {property.name}
          </Link>
          <h1 className="text-[clamp(1.375rem,2.5vw,1.875rem)] font-semibold leading-tight text-page-fg">
            Photos
          </h1>
          <p className="text-base text-page-fg-70">
            {property.gallery.length} of {property.photoCount} photos
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {property.gallery.map((frame, index) => (
            <figure key={frame.stem} className="m-0 flex flex-col gap-2">
              <picture>
                <source type="image/avif" srcSet={`/assets/${frame.stem}.avif`} />
                {/* Art-directed pair, matching the mosaic's source handling. */}
                <img
                  src={`/assets/${frame.stem}.jpg`}
                  alt={frame.alt}
                  width={1120}
                  height={747}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding={index === 0 ? "sync" : "async"}
                  className="w-full rounded-card object-cover"
                />
              </picture>
              <figcaption className="text-sm text-page-fg-70">{frame.alt}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A database property's photographs, through the photo route. Plain `<img>` for
 * the reason `components/property/database-property.tsx` records: the image
 * optimiser would cache what the route is meant to be able to refuse.
 */
function DatabaseGallery({ name, photos, slug }: { name: string; photos: string[]; slug: string }) {
  return (
    <div className="bg-background">
      <div className="container flex max-w-wide flex-col gap-8 pb-24 pt-24 lg:pt-28">
        <div className="flex flex-col gap-2">
          <Link
            href={`/property/${slug}`}
            className="inline-flex w-max items-center gap-2 text-sm text-page-fg-70 underline underline-offset-4 transition-colors hover:text-page-fg"
          >
            <BackArrow />
            Back to {name}
          </Link>
          <h1 className="text-2xl font-semibold leading-tight text-page-fg sm:text-3xl">Photos</h1>
          <p className="text-base text-page-fg-70">
            {photos.length === 1 ? "1 photo" : `${photos.length} photos`}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {photos.map((src, index) => (
            <figure key={src} className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- a photo route URL; see the note above */}
              <img
                src={src}
                alt={`${name}, photo ${index + 1} of ${photos.length}`}
                width={1120}
                height={747}
                loading={index === 0 ? "eager" : "lazy"}
                className="w-full rounded-card object-cover"
              />
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

function BackArrow() {
  return (
    <ChevronLeft width={14} height={14} strokeWidth={1.5} aria-hidden />
  );
}
