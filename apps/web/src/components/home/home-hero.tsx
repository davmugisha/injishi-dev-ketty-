import { getTranslations } from "next-intl/server";

import { StaySearchBar } from "@/components/search/stay-search-bar";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";

/**
 * The home hero: the headline and the search pill as the first action.
 *
 * The backdrop is one credited photograph (AVIF with a WebP fallback, both
 * responsive). It used to sit under a looping video, `oo-gorillas-nest-hero`,
 * which weighed 3.2 MB on a phone, put first paint past seven seconds on a slow
 * connection, and was the one piece of media on the site with no source or
 * licence on `/legal/photo-credits`. It was removed on 2026-10-21; do not bring
 * footage back without a recorded licence and a poster-only small screen.
 */
export async function HomeHero() {
  const t = await getTranslations("home");

  return (
    <section className="relative z-[11] h-dvh min-h-[680px] w-full overflow-hidden">
      {/* One even wash, no gradient: the photograph's brightest band is sky,
          exactly where the header and the white type sit. 38% holds the
          header's contrast without the old top scrim. Inline because
          `color-mix()`'s commas do not survive Tailwind's arbitrary values. */}
      <div
        aria-hidden
        className="absolute inset-0 z-[2]"
        style={{ backgroundColor: "color-mix(in srgb, var(--ink) 38%, transparent)" }}
      />

      <ArtDirectedImage
        stem="rwanda-lake-kivu"
        alt={t("hero.imageAlt")}
        sizes="100vw"
        width={1920}
        height={746}
        priority
        pictureClassName="absolute inset-0 block h-full w-full"
        className="z-0 h-full w-full object-center max-lg:object-[70%_0]"
      />

      <div className="absolute inset-0 z-10 flex flex-col items-center px-5 pb-20 pt-28 lg:pb-28">
        <div className="my-auto flex w-full flex-col items-center">
          <h1 className="mb-1.5 text-center text-display-sm font-medium text-white max-lg:max-w-tile lg:text-display-md">
            {t.rich("hero.title", { em: (chunks) => <span className="font-bold">{chunks}</span> })}
          </h1>
          <p className="animate-fade-up mb-8 text-center text-xl leading-[1.2] text-white opacity-0 [animation-fill-mode:forwards] max-lg:max-w-tile lg:text-3xl">
            {t("hero.subtitle")}
          </p>

          <div className="animate-fade-up w-full opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards] max-lg:max-w-form lg:w-auto">
            <StaySearchBar />
          </div>
        </div>
      </div>
    </section>
  );
}
