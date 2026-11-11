"use client";

import { Button, ProgressBar } from "@heroui/react";
import { type StockImage, stock } from "@injishi/data/media";
import { Photo } from "@injishi/ui";
import { useEffect, useState } from "react";

/**
 * The Bar & Restaurant slides show the product itself: a tablet with the real POS screen (floor, kitchen and bar
 * display, till), set over the venue photo the slide used before (credits of the photos stay those of `stock`).
 */
function posPreview(file: string, alt: string, base: StockImage): StockImage {
  return { ...base, src: `/stock/${file}`, alt, width: 1396, height: 1766 };
}

const SLIDES = [
  {
    id: "floor",
    tab: "Floor",
    image: posPreview(
      "pos-preview-floor.jpg",
      "A tablet showing the Injishi floor plan with table statuses, in front of a restaurant terrace",
      stock.isanganoTerrace,
    ),
    title: "Run a fast floor",
    body: "Seat guests, take orders and send them to the kitchen and bar from one screen, table by table.",
  },
  {
    id: "stations",
    tab: "Kitchen and bar",
    image: posPreview(
      "pos-preview-bar.jpg",
      "A tablet showing the Injishi kitchen display with order tickets, in front of a hotel bar",
      stock.lakeBar,
    ),
    title: "Kitchen and bar, in step",
    body: "Every ticket reaches the right station, with allergies flagged, timers running and nothing served twice.",
  },
  {
    id: "payments",
    tab: "Payments",
    image: posPreview(
      "pos-preview-till.jpg",
      "A tablet showing the Injishi till with dish photos and an order, over a grilled tilapia",
      stock.grilledTilapia,
    ),
    title: "Get paid, know your numbers",
    body: "Cash, MTN MoMo, Airtel Money and card, with sales, stock and staff on one dashboard.",
  },
  {
    id: "personal",
    tab: "Personal",
    image: stock.signInHeroTraveller,
    title: "One account, every workspace",
    body: "Book, host, rent and broker from a single Injishi identity. Switch workspace anytime.",
  },
  {
    id: "host",
    tab: "Host",
    image: stock.signInHeroHost,
    title: "Run a fast front desk",
    body: "Arrivals, check-ins, walk-ins and departures: your whole day on one Today screen.",
  },
  {
    id: "landlord",
    tab: "Landlord",
    image: stock.signInHeroLandlord,
    title: "Leases without the paper",
    body: "E-sign contracts, watch the rent roll, and settle the Caution. No paper anywhere.",
  },
  {
    id: "broker",
    tab: "Broker",
    image: stock.signInHeroBroker,
    title: "Place tenants, earn placement fees",
    body: "The private directory of residence units: reveal contact, place a tenant, get paid.",
  },
  {
    id: "compliance",
    tab: "Compliance",
    image: stock.signInHeroCompliance,
    title: "RRA handled in the background",
    body: "EBM e-invoices per sale and lease contracts auto-filed: compliance without the paperwork.",
  },
] as const;

const SLIDE_MS = 7000;
const TICK_MS = 100;

/** Left-hand hero of the sign-in page (cloned from the legacy demo): auto-advancing photo slides with tab progress. */
export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setElapsed((e) => {
        if (e + TICK_MS >= SLIDE_MS) {
          setIndex((i) => (i + 1) % SLIDES.length);
          return 0;
        }
        return e + TICK_MS;
      });
    }, TICK_MS);
    return () => window.clearInterval(t);
  }, [paused]);

  const slide = SLIDES[index];
  return (
    <section
      aria-roledescription="carousel"
      aria-label="What you can do with Injishi"
      className="relative flex h-full flex-col justify-end overflow-hidden rounded-[20px] bg-surface-tertiary"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`}
        >
          <Photo image={s.image} fill sizes="50vw" priority={i === 0} />
        </div>
      ))}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent"
      />
      <div className="relative flex flex-col gap-6 p-8 pb-7 text-white" aria-live="polite">
        <div className="flex max-w-[560px] flex-col gap-2">
          <h2 className="text-[28px] leading-9 font-semibold tracking-[-0.02em]">{slide.title}</h2>
          <p className="text-[13px] leading-5 text-white/85">{slide.body}</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Injishi for">
          {SLIDES.map((s, i) => (
            <Button
              key={s.id}
              aria-label={`${s.tab}: ${s.title}${i === index ? " (showing)" : ""}`}
              size="sm"
              variant="ghost"
              className="h-auto min-w-[84px] flex-col items-start gap-2 rounded-lg bg-white/10 px-2.5 pt-1.5 pb-2 text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur-sm hover:bg-white/20"
              onPress={() => {
                setIndex(i);
                setElapsed(0);
              }}
            >
              {s.tab}
              <ProgressBar
                aria-label={`${s.tab} slide progress`}
                size="sm"
                value={i === index ? (elapsed / SLIDE_MS) * 100 : i < index ? 100 : 0}
                className="w-full"
              >
                <ProgressBar.Track className="bg-white/25">
                  <ProgressBar.Fill className="bg-white" />
                </ProgressBar.Track>
              </ProgressBar>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
