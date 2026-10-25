"use client";

import { LEASE_STATUS_LABEL, type RentalUnitView, type UnitMediaView } from "@injishi/contracts";
import {
  ActionButton,
  DateText,
  EmptyBlock,
  ErrorBlock,
  KeyValueList,
  LoadingBlock,
  Money,
  PhotoGallery,
  SectionHeader,
  SidePanel,
  StatusChip,
  VideoPlayer,
} from "@injishi/ui";
import { useCallback, useEffect, useState } from "react";
import { loadUnitMedia } from "../actions";
import { bedroomsWords, unitStatus } from "../shared";
import { asVideo } from "./UnitMediaFields";

const KITCHEN: Record<string, string> = { own: "Its own", shared: "Shared", none: "None" };

/** The unit's photos as a shop shows a product (point or tap to zoom), and its video tour. */
function Media({ unit, canManage, onEdit }: { unit: RentalUnitView; canManage: boolean; onEdit: () => void }) {
  const [media, setMedia] = useState<UnitMediaView | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    const result = await loadUnitMedia(unit.id);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setMedia(result.value);
  }, [unit.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) return <ErrorBlock title="Couldn't load the photos" onRetry={() => void load()} />;
  if (!media) return <LoadingBlock shape="cards" label="photos" count={1} />;
  const video = asVideo(media.video);
  const canAdd = canManage && unit.state !== "retired";
  return (
    <>
      <PhotoGallery
        photos={media.photos.map((p) => ({ url: p.url }))}
        label={`Unit ${unit.label}`}
        empty={
          <EmptyBlock
            icon="Picture"
            title="No photos yet"
            description={canAdd ? "Add photos and a video tour in the unit's form." : undefined}
            size="sm"
            action={
              canAdd ? (
                <ActionButton icon="Plus" size="sm" onPress={onEdit}>
                  Add photos
                </ActionButton>
              ) : undefined
            }
          />
        }
      />
      {video ? (
        <section className="flex flex-col gap-2" aria-labelledby="unit-video">
          <SectionHeader id="unit-video" title="Video tour" />
          <VideoPlayer video={video} />
        </section>
      ) : null}
    </>
  );
}

/** One unit: its photos and video tour, the lease on it, its facts, and what can be done with it. */
export function UnitPanel({
  unit,
  canManage,
  onClose,
  onEdit,
  onRetire,
}: {
  unit: RentalUnitView;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRetire: () => void;
}) {
  const status = unitStatus(unit);
  const lease = unit.currentLease;
  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Bedrooms", value: bedroomsWords(unit.bedrooms) ?? "Not said" },
    { label: "Bathrooms", value: unit.bathrooms ?? "Not said" },
    { label: "Kitchen", value: unit.kitchen ? KITCHEN[unit.kitchen] : "Not said" },
    { label: "Furnished", value: unit.furnished ? "Yes" : "No" },
    ...(unit.floor !== null ? [{ label: "Floor", value: unit.floor === 0 ? "Ground" : unit.floor }] : []),
    ...(unit.sizeSqm !== null ? [{ label: "Size", value: `${unit.sizeSqm} m²` }] : []),
    { label: "Asking rent", value: unit.askingRentRwf !== null ? <Money value={unit.askingRentRwf} /> : "Not set" },
    ...(unit.askingDepositRwf !== null ? [{ label: "Deposit", value: <Money value={unit.askingDepositRwf} /> }] : []),
    ...(unit.availableFrom
      ? [{ label: "Available from", value: <DateText value={unit.availableFrom} style="long" /> }]
      : []),
    ...(unit.vacantSince ? [{ label: "Vacant since", value: <DateText value={unit.vacantSince} style="long" /> }] : []),
  ];
  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`Unit ${unit.label}`}
      description={[unit.blockName ?? unit.blockCode, unit.propertyName].filter(Boolean).join(" · ")}
      headerExtra={<StatusChip kind="unit" status={status} size="md" />}
      size="lg"
      footer={
        canManage && unit.state !== "retired" ? (
          <>
            <ActionButton icon="TrashBin" intent="danger-soft" onPress={onRetire}>
              Retire
            </ActionButton>
            <ActionButton icon="PencilToSquare" intent="primary" onPress={onEdit}>
              Edit unit
            </ActionButton>
          </>
        ) : undefined
      }
    >
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto">
        <Media unit={unit} canManage={canManage} onEdit={onEdit} />
        <section className="flex flex-col gap-2" aria-labelledby="unit-lease">
          <SectionHeader id="unit-lease" title="Tenancy" />
          {lease ? (
            <KeyValueList
              items={[
                { label: "Tenant", value: lease.tenantName },
                { label: "Lease", value: `${lease.reference} · ${LEASE_STATUS_LABEL[lease.status]}` },
                {
                  label: "Term",
                  value: (
                    <>
                      <DateText value={lease.startDate} /> to <DateText value={lease.endDate} />
                    </>
                  ),
                },
              ]}
            />
          ) : (
            <p className="text-sm text-muted">
              {unit.state === "off_market" ? "Off market, not let." : "Nobody lives here now."}
            </p>
          )}
        </section>
        <section className="flex flex-col gap-2" aria-labelledby="unit-facts">
          <SectionHeader id="unit-facts" title="Details" />
          <KeyValueList items={facts} />
          {unit.note ? <p className="text-sm whitespace-pre-line text-muted">{unit.note}</p> : null}
        </section>
      </div>
    </SidePanel>
  );
}
