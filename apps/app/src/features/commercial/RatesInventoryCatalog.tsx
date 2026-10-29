"use client";

import { Check, CircleInfo, Gift, Minus, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Card, Chip, Table } from "@heroui/react";
import { ItemCard } from "@heroui-pro/react";
import type {
  RatesInventoryAmenity,
  RatesInventoryMealPlan,
  RatesInventoryRoomType,
  RatesInventorySpace,
  RatesInventorySpaceDayState,
} from "@injishi/product-pms";
import { useBoardHref, usePmsMedia } from "@injishi/product-pms/web";
import { formatNumber, KeyValueList, LinkButton, Photo } from "@injishi/ui";

const DAY_STATE: Record<
  RatesInventorySpaceDayState,
  { label: string; color: "accent" | "default" | "warning" | "danger" }
> = {
  booked: { label: "Booked", color: "accent" },
  free: { label: "Free", color: "default" },
  hold: { label: "Hold", color: "warning" },
  clash: { label: "Clash", color: "danger" },
};

/** Spaces tab: event spaces with layouts, prices and the next seven days of bookings. */
export function RatesInventorySpaces({ spaces }: { spaces: RatesInventorySpace[] }) {
  const screenHref = useBoardHref();
  const { photo } = usePmsMedia();
  return (
    <div className="flex flex-col gap-5">
      <Alert>
        <Alert.Indicator>
          <CircleInfo />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Event spaces are separate from nightly rooms</Alert.Title>
          <Alert.Description>
            They never count toward occupancy or room availability. Bookings for a space are owned by Sales &amp;
            events, which checks for overlapping holds.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        {spaces.map((s) => (
          <Card key={s.id} role="region" aria-labelledby={`space-${s.id}-h`} className="gap-3 p-[18px]">
            <div className="relative h-[120px] overflow-hidden rounded-[14px] bg-surface-secondary">
              <Photo image={photo(s.photo)} fill sizes="(min-width: 1280px) 540px, 100vw" />
            </div>
            <Card.Header>
              <h2 id={`space-${s.id}-h`} className="text-[15px] leading-[22px] font-semibold">
                {s.name}
              </h2>
              <Card.Description>{s.kind}</Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <KeyValueList
                items={[
                  { label: "Layouts", value: s.layouts },
                  { label: "Prices", value: <span className="tabular">{s.prices}</span> },
                  { label: "Catering", value: s.catering },
                  { label: "Sold by", value: s.soldBy },
                ]}
              />
              <div className="flex flex-col gap-1.5">
                <span id={`space-${s.id}-week`} className="text-sm font-medium">
                  Next 7 days
                </span>
                <ul aria-labelledby={`space-${s.id}-week`} className="grid grid-cols-7 gap-1">
                  {s.week.map((day) => {
                    const look = DAY_STATE[day.state];
                    const date = Number(day.date.slice(8));
                    return (
                      <li key={day.date} className="min-w-0">
                        <Chip
                          variant="soft"
                          color={look.color}
                          className="h-11 w-full flex-col justify-center gap-0 rounded-[10px] px-0 text-[11px] leading-[14px]"
                        >
                          <span className="font-semibold tabular">{date}</span>
                          <span>{look.label}</span>
                        </Chip>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {s.warning ? (
                <Alert status="warning">
                  <Alert.Indicator>
                    <TriangleExclamation />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{s.warning.title}</Alert.Title>
                    <Alert.Description>{s.warning.description}</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
            </Card.Content>
            <Card.Footer>
              <LinkButton href={screenHref("SalesEvents")} size="sm" variant="secondary">
                Open in Sales &amp; events
              </LinkButton>
            </Card.Footer>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Amenities tab: which room types include each amenity, and whether it shows on the listing. */
export function RatesInventoryAmenities({
  amenities,
  roomTypes,
}: {
  amenities: RatesInventoryAmenity[];
  roomTypes: RatesInventoryRoomType[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Amenities by room type">
            <Table.Header>
              <Table.Column isRowHeader>Amenity</Table.Column>
              <Table.Column>Group</Table.Column>
              {roomTypes.map((t) => (
                <Table.Column key={t.id} id={t.id} className="text-center">
                  {t.name}
                </Table.Column>
              ))}
              <Table.Column>On listing</Table.Column>
            </Table.Header>
            <Table.Body>
              {amenities.map((a) => (
                <Table.Row key={a.id} id={a.id}>
                  <Table.Cell className="font-medium">{a.name}</Table.Cell>
                  <Table.Cell className="text-sm text-muted">{a.group}</Table.Cell>
                  {roomTypes.map((t) => (
                    <Table.Cell key={t.id} className="text-center">
                      {a.roomTypeIds.includes(t.id) ? (
                        <Check role="img" aria-label="Included" className="inline size-4 text-success" />
                      ) : (
                        <Minus role="img" aria-label="Not included" className="inline size-4 text-muted" />
                      )}
                    </Table.Cell>
                  ))}
                  <Table.Cell>
                    <Chip size="sm" variant="soft" color={a.onListing ? "success" : "default"}>
                      {a.onListing ? "Shown" : "Hidden"}
                    </Chip>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <p className="text-[12px] leading-4 text-muted">
        Property-wide: Wi-Fi in all areas · secure parking · lakefront garden · airport shuttle on request · step-free
        entrance and 2 accessible rooms (101, 102).
      </p>
    </div>
  );
}

/** Meal plans tab: what each board basis includes, its supplement, outlet and tax treatment. */
export function RatesInventoryMealPlans({ mealPlans }: { mealPlans: RatesInventoryMealPlan[] }) {
  const screenHref = useBoardHref();
  return (
    <div className="flex flex-col gap-5">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Meal plans">
            <Table.Header>
              <Table.Column isRowHeader>Meal plan</Table.Column>
              <Table.Column>Includes</Table.Column>
              <Table.Column className="text-right">Supplement</Table.Column>
              <Table.Column>Served by</Table.Column>
              <Table.Column>Tax classification</Table.Column>
              <Table.Column>Used by</Table.Column>
            </Table.Header>
            <Table.Body>
              {mealPlans.map((m) => (
                <Table.Row key={m.id} id={m.id}>
                  <Table.Cell>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-[12px] leading-4 text-muted tabular">{m.code}</span>
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-sm">{m.includes}</Table.Cell>
                  <Table.Cell className="text-right text-sm tabular">
                    {m.supplementPerGuest === null ? "—" : `${formatNumber(m.supplementPerGuest)} / guest`}
                  </Table.Cell>
                  <Table.Cell className="text-sm">{m.servedBy ?? "—"}</Table.Cell>
                  <Table.Cell className="text-sm tabular">{m.taxClassification ?? "—"}</Table.Cell>
                  <Table.Cell className="text-sm">{m.usedBy}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <ItemCard variant="secondary">
        <ItemCard.Icon>
          <Gift />
        </ItemCard.Icon>
        <ItemCard.Content>
          <ItemCard.Title>Selling meals with activities or events?</ItemCard.Title>
          <ItemCard.Description>
            Packages combine rooms with outlet, event and third-party components, each with its own seller and tax
            treatment.
          </ItemCard.Description>
        </ItemCard.Content>
        <ItemCard.Action>
          <LinkButton href={screenHref("Packages")} size="sm" variant="secondary">
            Open packages
          </LinkButton>
        </ItemCard.Action>
      </ItemCard>
    </div>
  );
}
