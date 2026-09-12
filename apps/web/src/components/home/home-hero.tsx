import { StaySearchBar } from "@/components/search/stay-search-bar";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";

/**
 * The home hero.
 *
 * A still frame paints immediately (AVIF with a WebP fallback, both
 * responsive) and the looping video layers over it once it can play. The
 * prototype started the image at `opacity-0` and revealed it from a script;
 * with build-time CSS there is nothing to wait for, so it paints opaque.
 */
export function HomeHero() {
  return (
    <section className="Banner relative z-[11] w-full before:absolute before:left-1/2 before:z-10 before:h-[900px] before:w-full before:-translate-x-1/2 before:bg-[url(/assets/injishi-short-white-outline.svg)] before:bg-contain before:bg-center before:bg-no-repeat before:opacity-10 before:content-[''] after:absolute after:bottom-0 after:left-0 after:z-[1] after:h-full after:w-full after:bg-[linear-gradient(180deg,transparent_0%,var(--color-ink-950)_100%)] after:bg-cover after:bg-center after:opacity-100 after:content-[''] after:pointer-events-none max-lg:before:bottom-0 lg:before:top-[-10%] lg:before:max-w-wide">
      {/* Top scrim so the transparent header keeps contrast over the photograph.
          It used to be `lg:hidden`, on the assumption that only small screens
          needed it. Measured against the hero photograph, the desktop header was
          the worst contrast on the site: "Sign In" at 1.14:1 across its whole
          footprint, Explore and Support at ~1.08:1 over the bright sky. The
          scrim already had the right shape, it was just switched off at exactly
          the width where the header is widest. */}
      <div className="absolute left-0 top-0 z-10 h-[280px] w-full bg-[linear-gradient(to_bottom,var(--color-ink-950),transparent_75%)]" />

      <ArtDirectedImage
        stem="rwanda-lake-kivu"
        alt="Sunset over water with silhouetted mountains"
        sizes="100vw"
        width={1920}
        height={746}
        priority
        className="z-0 h-dvh w-full object-center max-lg:object-[70%_0]"
      />

      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/oo-gorillas-nest-hero-960.avif"
        title="Stay anywhere in Rwanda"
        aria-hidden
        className="absolute left-0 top-0 z-[1] h-full w-full object-cover max-lg:object-[70%_0] [&::-webkit-media-controls]:!hidden [&::-webkit-media-controls-play-button]:!hidden [&::-webkit-media-controls-start-playback-button]:!hidden"
      >
        <source src="/media/oo-gorillas-nest-hero.webm" type="video/webm" />
        <source src="/media/oo-gorillas-nest-hero.mp4" type="video/mp4" />
        <track kind="captions" />
      </video>

      <div className="absolute left-0 top-0 z-10 flex h-full w-full flex-col items-center justify-center px-5 lg:gap-20">
        <div className="mt-auto flex w-full flex-col items-center">
          <h1 className="mb-1.5 text-center text-display-sm font-medium text-white max-lg:max-w-tile lg:text-display-md">
            Stay anywhere<span className="font-bold"> in Rwanda</span>
          </h1>
          <p className="animate-fade-up text-center text-xl leading-[1.2] text-white opacity-0 [animation-fill-mode:forwards] max-lg:mb-7 max-lg:max-w-tile lg:text-3xl">
            Guesthouses, lodges and serviced apartments, across Rwanda.
          </p>
          {/* /75, not /50. At 15px this line needs 4.5:1, and the ground under
              it is a moving photograph rather than a fixed colour. Sampled
              against the real video across five frames, white at 50% measured
              between roughly 3.9:1 and 5.2:1 — it passed only while the frame
              happened to be dark, and the still that paints before the video
              decodes is the brightest ground on the page. /75 clears the floor
              on every frame, so the line stops depending on what is playing. */}
          <p className="animate-fade-up mb-10 max-w-wide text-center text-base text-white/75 opacity-0 [animation-delay:0.1s] [animation-fill-mode:forwards] max-lg:max-w-tile max-lg:text-center">
            Book verified guesthouses, lodges and serviced apartments across Rwanda.
            Escrow-backed payment, self check-in, and no phone calls from search to
            arrival.
          </p>
        </div>

        {/* The bar sits under the copy at every width — the phone used to hoist
            it above the headline, which read as a second header rather than as
            the hero's first action. `w-full` also stops the collapsed pill from
            resizing itself as its summary text grows. */}
        <div className="animate-fade-up mb-12 opacity-0 [animation-delay:0.3s] [animation-fill-mode:forwards] max-lg:w-full max-lg:max-w-form lg:mb-16">
          <StaySearchBar />
        </div>
      </div>
    </section>
  );
}
