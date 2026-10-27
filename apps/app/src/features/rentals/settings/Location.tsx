"use client";

import { Chip, toast } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import type { RentalPropertyView } from "@injishi/contracts";
import {
  ActionButton,
  EmptyBlock,
  IconAction,
  isPlaceComplete,
  type PlaceChain,
  PlacePicker,
  placeLine,
  SectionCard,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveLocation } from "../actions";
import { fieldErrorsOnly, TextInput } from "../fields";
import { loadPlaces } from "../places";

const chainOf = (p: RentalPropertyView): PlaceChain => ({
  province: p.place.province,
  district: p.place.district,
  sector: p.place.sector,
  cell: p.place.cell,
  village: p.place.village,
});

function LocationPanel({ property, onClose }: { property: RentalPropertyView; onClose: () => void }) {
  const router = useRouter();
  const [chain, setChain] = useState<PlaceChain>(() => chainOf(property));
  const [street, setStreet] = useState(property.street ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (!isPlaceComplete(chain, "village")) {
      setPlaceError("Choose every level, down to the village.");
      return;
    }
    setPlaceError(null);
    start(async () => {
      const result = await saveLocation(property.id, {
        provinceId: Number(chain.province?.id),
        districtId: Number(chain.district?.id),
        sectorId: Number(chain.sector?.id),
        cellId: Number(chain.cell?.id),
        villageId: Number(chain.village?.id),
        street,
      });
      if (!result.ok) {
        const fields = fieldErrorsOnly(result.fieldErrors);
        const place = ["provinceId", "districtId", "sectorId", "cellId", "villageId"]
          .map((k) => fields[k])
          .find(Boolean);
        setPlaceError(place ?? null);
        setErrors(fields);
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      toast.success("Location saved");
      onClose();
      router.refresh();
    });
  };

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Where is it?"
      description={property.name}
      submitLabel="Save location"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <PlacePicker
        label="Place"
        value={chain}
        onChange={(next) => {
          setChain(next);
          setPlaceError(null);
        }}
        loadPlaces={loadPlaces}
        errorMessage={placeError}
      />
      <TextInput
        label="Street and house"
        name="street"
        value={street}
        onChange={setStreet}
        placeholder="KG 9 Ave, house 14"
        description="Optional. Helps tenants and visitors find it."
      />
    </SidePanel>
  );
}

/** Where the business's buildings are, down to the village: contracts name it and guest reports follow it. */
export function Location({ properties, canEdit }: { properties: RentalPropertyView[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<RentalPropertyView | null>(null);
  return (
    <SectionCard
      title="Buildings"
      description="Contracts name it, and guest reports reach the village leader."
      contentClassName="gap-0"
    >
      {properties.length === 0 ? (
        <EmptyBlock size="sm" icon="MapPin" title="No building yet" description="Your first unit makes one." />
      ) : (
        <ListView aria-label="Buildings" variant="secondary" items={properties}>
          {(p) => {
            const line = placeLine(chainOf(p));
            return (
              <ListView.Item id={p.id} textValue={p.name} className="items-center">
                <ListView.ItemContent className="items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <ListView.Title className="flex flex-wrap items-center gap-2 whitespace-normal">
                      {p.name}
                      {p.located ? null : (
                        <Chip size="sm" color="warning" variant="soft">
                          Add the village
                        </Chip>
                      )}
                    </ListView.Title>
                    <ListView.Description className="whitespace-normal">
                      {[p.street, line].filter(Boolean).join(" · ") || "No address yet"}
                    </ListView.Description>
                  </span>
                </ListView.ItemContent>
                {canEdit ? (
                  <ListView.ItemAction>
                    {p.located ? (
                      <IconAction icon="PencilToSquare" label="Edit location" onPress={() => setEditing(p)} />
                    ) : (
                      <ActionButton size="sm" icon="MapPin" intent="primary" onPress={() => setEditing(p)}>
                        Set location
                      </ActionButton>
                    )}
                  </ListView.ItemAction>
                ) : null}
              </ListView.Item>
            );
          }}
        </ListView>
      )}
      {editing ? <LocationPanel property={editing} onClose={() => setEditing(null)} /> : null}
    </SectionCard>
  );
}
