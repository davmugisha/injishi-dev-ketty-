import type { Meta, StoryObj } from "@storybook/react-vite";
import { cn } from "@injishi/utils";
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../src/components/carousel";
// Photographs `apps/web` already ships, read in place rather than copied.
import kivu from "../../../apps/web/public/assets/lake-kivu-01-480.webp";
import kivu2 from "../../../apps/web/public/assets/lake-kivu-02-480.webp";
import akagera from "../../../apps/web/public/assets/akagera-np-01-480.webp";
import nyungwe from "../../../apps/web/public/assets/nyungwe-forest-02-480.webp";
import kigali from "../../../apps/web/public/assets/kigali-hills-view-01-480.webp";

/**
 * Slides on Embla. Slide width is the slide's own `basis-*` class, so how many
 * show at once stays in the markup with the rest of the layout. The arrows sit
 * outside the deck by default (`-left-12`, `-right-12`); a gallery pulls them
 * inside with a class. The left and right arrow keys move the deck when focus
 * is inside it.
 *
 * `CarouselDots` ships UNSTYLED: it renders `[data-dot]` buttons and leaves
 * their look to the caller, because the one caller paints them white on a
 * photograph. The Gallery story dresses them the way that caller does.
 */
const meta = {
  title: "Primitives/Carousel",
  component: Carousel,
} satisfies Meta<typeof Carousel>;

export default meta;
type Story = StoryObj<typeof meta>;

const STAYS = [
  { src: kivu, name: "Lake Kivu Lodge (demo)", place: "Rubavu" },
  { src: akagera, name: "Akagera Tented Camp (demo)", place: "Kayonza" },
  { src: nyungwe, name: "Nyungwe Forest Camp (demo)", place: "Nyamasheke" },
  { src: kigali, name: "Kigali Heights Suites (demo)", place: "Gasabo" },
  { src: kivu2, name: "Karongi Bay House (demo)", place: "Karongi" },
];

/** A deck of listing cards, two to a view on a wide screen. */
export const Deck: Story = {
  render: (args) => (
    <div className="max-w-wide px-12">
      <Carousel {...args} opts={{ align: "start" }}>
        <CarouselContent>
          {STAYS.map((stay) => (
            <CarouselItem key={stay.name} className="sm:basis-1/2">
              <figure className="flex flex-col gap-2">
                <img src={stay.src} alt="" className="aspect-[4/3] w-full rounded-card object-cover" />
                <figcaption className="text-sm">
                  <span className="block font-semibold">{stay.name}</span>
                  <span className="text-muted-foreground">{stay.place}</span>
                </figcaption>
              </figure>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  ),
};

/**
 * The explore result card's photo gallery: one photo to a view, the arrows
 * pulled inside, and the dots dressed by the caller on the photograph.
 */
export const Gallery: Story = {
  render: (args) => (
    <div className="max-w-tile">
      <Carousel {...args} className="group/gallery overflow-hidden rounded-card">
        <CarouselContent className="ml-0">
          {STAYS.map((stay, index) => (
            <CarouselItem key={stay.name} className="pl-0">
              <img
                src={stay.src}
                alt={`Photo ${index + 1} of ${STAYS.length}`}
                className="aspect-[4/3] w-full object-cover"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* The arrows draw their own icon; children passed to them are not rendered. */}
        <CarouselPrevious className="left-2 top-1/2 z-20 size-8 -translate-y-1/2 border-none bg-white/90 text-ink shadow-control hover:bg-white" />
        <CarouselNext className="right-2 top-1/2 z-20 size-8 -translate-y-1/2 border-none bg-white/90 text-ink shadow-control hover:bg-white" />
        <CarouselDots
          className={cn(
            "absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1",
            "[&_[data-dot]]:size-1.5 [&_[data-dot]]:rounded-full [&_[data-dot]]:bg-white/60 [&_[data-dot]]:transition-all",
            "[&_[data-dot][data-active=true]]:w-3.5 [&_[data-dot][data-active=true]]:bg-white",
          )}
        />
      </Carousel>
    </div>
  ),
};

/** Fewer slides than fit: both arrows are refused, and no dots are drawn. */
export const NothingToScroll: Story = {
  render: (args) => (
    <div className="max-w-wide px-12">
      <Carousel {...args} opts={{ align: "start" }}>
        <CarouselContent>
          {STAYS.slice(0, 2).map((stay) => (
            <CarouselItem key={stay.name} className="basis-1/2">
              <img src={stay.src} alt="" className="aspect-[4/3] w-full rounded-card object-cover" />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
        <CarouselDots />
      </Carousel>
    </div>
  ),
};
