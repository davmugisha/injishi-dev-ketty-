"use client";

import { toast } from "@heroui/react";
import {
  LEASE_STATUS_LABEL,
  type RentalUnitView,
  UNIT_PHOTO_MAX,
  UNIT_PHOTO_MAX_BYTES,
  UNIT_VIDEO_MAX_BYTES,
  type UnitMediaView,
  type UnitPhotoView,
  type UnitVideoView,
} from "@injishi/contracts";
import {
  ActionButton,
  DateText,
  ErrorBlock,
  KeyValueList,
  LoadingBlock,
  Money,
  type PhotoItem,
  PhotoUploader,
  SectionHeader,
  SidePanel,
  StatusChip,
  VideoField,
  type VideoItem,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadUnitMedia, removeUnitPhoto, removeUnitVideo, reorderUnitPhotos } from "../actions";
import { bedroomsWords, unitStatus } from "../shared";
import { uploadWithProgress } from "../upload";

const KITCHEN: Record<string, string> = { own: "Its own", shared: "Shared", none: "None" };

const asPhoto = (p: UnitPhotoView): PhotoItem => ({ id: p.id, url: p.url });
const asVideo = (v: UnitVideoView | null): VideoItem | null =>
  v ? { url: v.url, posterUrl: v.posterUrl, durationS: v.durationS } : null;

function Media({ unit, canManage }: { unit: RentalUnitView; canManage: boolean }) {
  const router = useRouter();
  const [media, setMedia] = useState<UnitMediaView | null>(null);
  const [failed, setFailed] = useState(false);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [video, setVideo] = useState<VideoItem | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const result = await loadUnitMedia(unit.id);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setMedia(result.value);
    setPhotos(result.value.photos.map(asPhoto));
    setVideo(asVideo(result.value.video));
  }, [unit.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) return <ErrorBlock title="Couldn't load the photos" onRetry={() => void load()} />;
  if (!media) return <LoadingBlock shape="cards" label="photos" count={2} />;
  const locked = !canManage || unit.state === "retired";
  return (
    <>
      <PhotoUploader
        label="Photos"
        photos={photos}
        max={UNIT_PHOTO_MAX}
        maxBytes={UNIT_PHOTO_MAX_BYTES}
        isDisabled={locked}
        upload={async (file, onProgress, signal) => {
          const form = new FormData();
          form.append("file", file, file.name);
          const saved = await uploadWithProgress<UnitPhotoView>(
            `/api/rentals/units/${unit.id}/photos`,
            "POST",
            form,
            onProgress,
            signal,
          );
          return asPhoto(saved);
        }}
        onUploaded={(photo) => {
          setPhotos((list) => [...list, photo]);
          router.refresh();
        }}
        onReorder={
          locked
            ? undefined
            : async (next) => {
                const before = photos;
                setPhotos(next);
                const result = await reorderUnitPhotos(
                  unit.id,
                  next.map((p) => p.id),
                );
                if (!result.ok) {
                  setPhotos(before);
                  toast.danger(result.error);
                }
              }
        }
        onRemove={
          locked
            ? undefined
            : async (photo) => {
                const result = await removeUnitPhoto(unit.id, photo.id);
                if (!result.ok) {
                  toast.danger(result.error);
                  return;
                }
                setPhotos(result.value.photos.map(asPhoto));
              }
        }
      />
      <VideoField
        label="Video tour"
        video={video}
        maxBytes={UNIT_VIDEO_MAX_BYTES}
        isDisabled={locked}
        upload={async (file, facts, onProgress, signal) => {
          const form = new FormData();
          form.append("durationS", String(facts.durationS));
          if (facts.width) form.append("width", String(facts.width));
          if (facts.height) form.append("height", String(facts.height));
          if (facts.poster) form.append("poster", facts.poster, "poster.jpg");
          form.append("file", file, file.name);
          const saved = await uploadWithProgress<UnitVideoView>(
            `/api/rentals/units/${unit.id}/video`,
            "PUT",
            form,
            onProgress,
            signal,
          );
          return asVideo(saved) as VideoItem;
        }}
        onUploaded={(v) => {
          setVideo(v);
          toast.success("Video saved");
        }}
        onRemove={
          locked
            ? undefined
            : async () => {
                const result = await removeUnitVideo(unit.id);
                if (!result.ok) {
                  toast.danger(result.error);
                  return;
                }
                setVideo(null);
              }
        }
      />
    </>
  );
}

/** One unit: its facts, the lease on it, its photos and video tour, and what can be done with it. */
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
        <Media unit={unit} canManage={canManage} />
      </div>
    </SidePanel>
  );
}
