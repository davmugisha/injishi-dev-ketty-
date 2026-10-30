"use client";

import { Calendar, Plus } from "@gravity-ui/icons";
import { Button, Chip, Tabs } from "@heroui/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  RatesInventoryAmenity,
  RatesInventoryMealPlan,
  RatesInventoryRatePlan,
  RatesInventoryRoomType,
  RatesInventorySpace,
} from "@injishi/data/fixtures/commercial";
import { LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { RatesInventoryAmenities, RatesInventoryMealPlans, RatesInventorySpaces } from "./RatesInventoryCatalog";
import { RatesInventoryRatePlans } from "./RatesInventoryRatePlans";
import { RatesInventoryRoomTypes } from "./RatesInventoryRoomTypes";
import { RATES_INVENTORY_TABS, type RatesInventoryTab } from "./RatesInventoryTabs";

interface RatesInventoryData {
  roomTypes: RatesInventoryRoomType[];
  ratePlans: RatesInventoryRatePlan[];
  spaces: RatesInventorySpace[];
  amenities: RatesInventoryAmenity[];
  mealPlans: RatesInventoryMealPlan[];
}

/** Manager · Rates & Inventory: room types, rate plans (with the effective-dated editor), spaces, amenities, meal plans. */
export function RatesInventoryView({
  persona,
  data,
  initialTab = "rates",
}: {
  persona: Persona;
  data: RatesInventoryData;
  initialTab?: RatesInventoryTab;
}) {
  const [tab, setTab] = useState<RatesInventoryTab>(initialTab);
  const counts: Record<RatesInventoryTab, number> = {
    types: data.roomTypes.length,
    rates: data.ratePlans.length,
    spaces: data.spaces.length,
    amen: data.amenities.length,
    meals: data.mealPlans.length,
  };
  const current = RATES_INVENTORY_TABS.find((t) => t.id === tab) ?? RATES_INVENTORY_TABS[1];

  return (
    <PageContent>
      <PageHeader
        eyebrow="Isangano Lakeside Hotel · Commercial"
        title="Rates & Inventory"
        actions={
          <>
            <LinkButton href={screenHref("AvailabilityCalendar")} variant="secondary">
              <Calendar className="size-4" aria-hidden="true" />
              Availability calendar
            </LinkButton>
            <Button>
              <Plus className="size-4" aria-hidden="true" />
              {current.action}
            </Button>
          </>
        }
      />

      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as RatesInventoryTab)}
        className="gap-5"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Inventory sections" className="min-w-0 gap-1">
            {RATES_INVENTORY_TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className="h-10 w-auto gap-2 px-3 text-[14px]">
                {t.label}
                <Chip size="sm" className="tabular">
                  {counts[t.id]}
                </Chip>
                <Tabs.Indicator className="inset-x-2 w-auto" />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="types" className="mt-0 p-0">
          <RatesInventoryRoomTypes roomTypes={data.roomTypes} />
        </Tabs.Panel>
        <Tabs.Panel id="rates" className="mt-0 p-0">
          <RatesInventoryRatePlans persona={persona} plans={data.ratePlans} />
        </Tabs.Panel>
        <Tabs.Panel id="spaces" className="mt-0 p-0">
          <RatesInventorySpaces spaces={data.spaces} />
        </Tabs.Panel>
        <Tabs.Panel id="amen" className="mt-0 p-0">
          <RatesInventoryAmenities amenities={data.amenities} roomTypes={data.roomTypes} />
        </Tabs.Panel>
        <Tabs.Panel id="meals" className="mt-0 p-0">
          <RatesInventoryMealPlans mealPlans={data.mealPlans} />
        </Tabs.Panel>
      </Tabs>
    </PageContent>
  );
}
