"use client";

import { Card, Chip } from "@heroui/react";
import type { BrokerHome } from "@injishi/contracts";
import { ActionLink, formatMoney, Icon } from "@injishi/ui";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { canMessagePlacement, placementMessageHref } from "../messages/links";
import { feeTermsWords, roomsWords } from "./shared";

const PRESS =
  "group flex min-h-0 w-full flex-1 flex-col text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

/** The card opens the home: in place (a panel) or by its address. */
function Press({ href, onPress, children }: { href?: string; onPress?: () => void; children: ReactNode }) {
  return href ? (
    <NextLink href={href} className={PRESS}>
      {children}
    </NextLink>
  ) : (
    <button type="button" onClick={onPress} className={PRESS}>
      {children}
    </button>
  );
}

/** One home a broker may offer: its cover photo, rent, where, what it is, and the fee. */
export function HomeCard({ home, onOpen, href }: { home: BrokerHome; onOpen?: () => void; href?: string }) {
  const facts = [
    roomsWords(home.bedrooms),
    home.bathrooms ? `${home.bathrooms} bath` : null,
    home.furnished ? "Furnished" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const cover = home.photos[0];
  return (
    <Card className="w-full gap-0 overflow-hidden p-0">
      <Press href={href} onPress={onOpen}>
        <div className="relative aspect-video w-full overflow-hidden bg-default">
          {cover ? (
            // biome-ignore lint/performance/noImgElement: signed, short-lived URLs
            <img
              src={cover}
              alt={`Unit ${home.unitLabel}`}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-muted">
              <Icon name="FolderHouse" className="size-8" />
            </span>
          )}
          <span className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {home.photos.length > 1 ? (
              <Chip size="sm" className="bg-black/60 text-white">
                <Icon name="Picture" className="size-3.5" />
                {home.photos.length}
              </Chip>
            ) : null}
            {home.placement ? (
              <Chip size="sm" className="bg-black/60 text-white">
                <Icon name="Persons" className="size-3.5" />
                {home.placement.status === "initiated" ? "Placement open" : "Placed"}
              </Chip>
            ) : home.contact ? (
              <Chip size="sm" className="bg-black/60 text-white">
                <Icon name="Handset" className="size-3.5" />
                Contact revealed
              </Chip>
            ) : null}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-semibold">{home.propertyName}</span>
              <span className="truncate text-xs text-muted">
                {[`Unit ${home.unitLabel}`, [home.sector, home.district].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {facts ? <span className="truncate text-xs text-muted">{facts}</span> : null}
            </div>
            <span className="shrink-0 text-right">
              <span className="block font-semibold tabular">{formatMoney(home.rentRwf)}</span>
              <span className="block text-xs text-muted">a month</span>
            </span>
          </div>
          <span
            className="mt-auto flex items-center justify-between gap-2 rounded-lg bg-default/60 px-3 py-2 text-sm"
            title={home.fee.kind === "percent" ? feeTermsWords(home.fee) : undefined}
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate text-muted">
              <Icon name="Wallet" />
              Your fee{home.fee.kind === "percent" ? ` (${home.fee.percent}%)` : ""}
            </span>
            <span className="shrink-0 font-semibold tabular">{formatMoney(home.feeRwf)}</span>
          </span>
        </div>
      </Press>
      {home.placement && canMessagePlacement(home.placement.status) ? (
        <div className="flex justify-end border-t border-separator px-4 py-3">
          <ActionLink href={placementMessageHref(home.placement.id)} size="sm" icon="Comments">
            Message landlord
          </ActionLink>
        </div>
      ) : null}
    </Card>
  );
}
