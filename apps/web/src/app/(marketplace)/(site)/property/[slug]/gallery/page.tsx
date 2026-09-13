import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findDiscoverableProperty } from "@/data/discovery";
import { propertyMetadata, propertyStaticParams } from "@/lib/property-route";

/**
 * The full-gallery route.
 *
 * The mosaic on the property page has linked here since it was built, and until
 * now the link went nowhere. It stays deliberately plain: a back link, the
 * property name, and the photographs at a size worth opening a gallery for.
 * Nothing competes with the pictures.
 */

export function generateStaticParams() {
  return propertyStaticParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return propertyMetadata(params, (property) => ({
    title: `${property.name} photos`,
  }));
}

export default async function PropertyGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await findDiscoverableProperty(slug);
  if (!property) notFound();

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

function BackArrow() {
  return (
    <ChevronLeft width={14} height={14} strokeWidth={1.5} aria-hidden />
  );
}
