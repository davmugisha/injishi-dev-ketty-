"use client";

import { Share, Star } from "lucide-react";
import { useState } from "react";
import { Button } from "@injishi/ui";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import { formatRateNumber } from "@/lib/price";
import type { PropertyDetail } from "@/data/properties";

/**
 * The title row and the rating line beneath the mosaic.
 *
 * The reference moved the name above the photographs, which reads better than
 * laying it over them: the title stays legible whatever the photograph is doing
 * behind it, and the photographs get to be photographs. Share and save sit at
 * the far end of the same line because they act on the listing as a whole.
 *
 * The rating is the piece this page was missing entirely. It goes directly
 * under the property type, where a guest scanning for social proof looks first.
 */
export function PropertyTitle({ property }: { property: PropertyDetail }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = typeof window === "undefined" ? "" : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: property.name, url });
        return;
      } catch {
        // A dismissed share sheet is not an error; fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  /*
    The facts a traveller needs before they will look at photographs at all:
    what class of place this is, where it stands, how big it is and what it
    costs. They were all sitting below the mosaic, so the first screen of a
    listing carried the name and nothing else — everything that makes the
    listing checkable was a scroll away.

    Only what the source actually published is shown. A property with no star
    class or no advertised rate simply contributes fewer facts here rather than
    borrowing a plausible one.
  */
  const facts = [
    property.starClass ? `${property.starClass}-star` : null,
    property.location,
    property.rooms ? `${property.rooms} rooms` : null,
    formatRateNumber(property.price.fromRwf)
      ? `from ${formatRateNumber(property.price.fromRwf)} RWF ${property.price.basis}`
      : "Rate on request",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/*
          The reference sets this at a flat 26px. That is inside the `title` step
          DESIGN.md already documents — clamp(1.375rem, 2.5vw, 1.875rem) — so the
          ramp is used rather than the borrowed literal, which also makes the
          heading responsive instead of fixed.
        */}
        <h1 className="text-[clamp(1.375rem,2.5vw,1.875rem)] font-semibold leading-tight text-page-fg">
          {property.name}
        </h1>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            shape="rounded"
            onClick={share}
            className="gap-2 px-3 text-page-fg underline underline-offset-4"
          >
            <ShareIcon />
            {copied ? "Link copied" : "Share"}
          </Button>
          <SaveStayButton
            slug={property.slug}
            appearance="labelled"
            label="Save"
            size="sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-page-fg-70">
        {property.rating ? (
          <>
            <span className="flex items-center gap-1.5 text-page-fg">
              <StarGlyph />
              <b className="font-semibold">
                {property.rating.score}/{property.rating.outOf}
              </b>
              <span className="font-normal text-page-fg-70">
                on {property.rating.source}
              </span>
            </span>
            <span aria-hidden>·</span>
          </>
        ) : null}
        {facts.map((fact, i) => (
          <span key={fact} className="flex items-center gap-2">
            {fact}
            {i < facts.length - 1 ? <span aria-hidden>·</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The type, capacity and rating block that opens the left column. */
export function PropertySubtitle({ property }: { property: PropertyDetail }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold leading-tight text-page-fg">
        {property.propertyType}
      </h2>
      <p className="text-base text-page-fg-70">{property.capacity.join(" · ")}</p>
      {/*
        The score moved up beside the name, where a guest scanning for social
        proof looks first — it was below the mosaic, off the first screen. The
        link back to the source stays here so the number remains checkable.
      */}
      {property.rating ? (
        <a
          href={property.rating.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-max text-sm text-page-fg-70 underline underline-offset-2 hover:opacity-80"
        >
          Guest score published by {property.rating.source}
        </a>
      ) : null}
    </div>
  );
}

function StarGlyph() {
  return (
    <Star width={14} height={14} stroke="none" fill="currentColor" aria-hidden />
  );
}

function ShareIcon() {
  return (
    <Share width={15} height={15} strokeWidth={1.4} aria-hidden />
  );
}
