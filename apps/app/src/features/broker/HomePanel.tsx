"use client";

import { toast } from "@heroui/react";
import type { BrokerHome } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import { homeCoverPhoto } from "@injishi/data/home-stock";
import {
  ActionButton,
  ActionLink,
  FormDialog,
  formatDay,
  formatMoney,
  KeyValueList,
  PhotoGallery,
  SectionHeader,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { canMessagePlacement, placementMessageHref } from "../messages/links";
import { fieldErrorsOnly, TextInput } from "../rentals/fields";
import { loadHome, revealLandlord, startPlacement } from "./actions";
import { feeTermsWords, PlacementChip, roomsWords } from "./shared";

const KITCHEN: Record<string, string> = { own: "Its own", shared: "Shared", none: "None" };

/**
 * One home in full, beside the list: every photo (point to zoom), what it is, the fee the landlord set,
 * and the landlord. Revealing the contact is free; "I have a tenant" starts a placement, which the
 * landlord hears about and names on the lease.
 */
export function HomePanel({ home: initial, onClose }: { home: BrokerHome; onClose: () => void }) {
  const router = useRouter();
  const [home, setHome] = useState(initial);
  const [placing, setPlacing] = useState(false);
  const [revealing, startReveal] = useTransition();

  // Every photo, not only the card's first few.
  useEffect(() => {
    let live = true;
    loadHome(initial.unitId).then((r) => {
      if (live && r.ok) setHome(r.value);
    });
    return () => {
      live = false;
    };
  }, [initial.unitId]);

  const reveal = () =>
    startReveal(async () => {
      const r = await revealLandlord(home.unitId);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      setHome((h) => ({ ...h, contact: r.value.contact }));
      router.refresh();
    });

  const facts = [
    { label: "Rent", value: `${formatMoney(home.rentRwf)} a month` },
    ...(home.depositRwf !== null ? [{ label: "Deposit", value: formatMoney(home.depositRwf) }] : []),
    {
      label: "Rooms",
      value:
        [roomsWords(home.bedrooms), home.bathrooms ? `${home.bathrooms} bath` : null].filter(Boolean).join(", ") ||
        "Not said",
    },
    ...(home.kitchen ? [{ label: "Kitchen", value: KITCHEN[home.kitchen] ?? home.kitchen }] : []),
    ...(home.sizeSqm ? [{ label: "Size", value: `${home.sizeSqm} m²` }] : []),
    { label: "Furnished", value: home.furnished ? "Yes" : "No" },
    { label: "Available", value: home.availableFrom ? `From ${formatDay(home.availableFrom, "long")}` : "Now" },
    { label: "Where", value: [home.sector, home.district].filter(Boolean).join(", ") || "Rwanda" },
  ];

  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={`${home.unitLabel} · ${home.propertyName}`}
        description={[home.sector, home.district].filter(Boolean).join(", ") || home.landlordName}
        headerExtra={home.placement ? <PlacementChip status={home.placement.status} /> : null}
        size="lg"
        footer={
          home.placement ? (
            <>
              <ActionLink href={screenHref("BrokerPlacements")} icon="Persons">
                See placements
              </ActionLink>
              {canMessagePlacement(home.placement.status) ? (
                <ActionLink href={placementMessageHref(home.placement.id)} icon="Comments">
                  Message landlord
                </ActionLink>
              ) : null}
            </>
          ) : (
            <>
              <ActionButton onPress={onClose}>Close</ActionButton>
              <ActionButton intent="primary" icon="Persons" onPress={() => setPlacing(true)} isDisabled={!home.contact}>
                I have a tenant
              </ActionButton>
            </>
          )
        }
      >
        <PhotoGallery
          photos={
            home.photos.length > 0
              ? home.photos.map((url, i) => ({ url, alt: i === 0 ? `Unit ${home.unitLabel}` : undefined }))
              : (() => {
                  const cover = homeCoverPhoto(home.unitId, home.photos);
                  return [{ url: cover.src, alt: cover.alt }];
                })()
          }
          label={`Unit ${home.unitLabel}`}
        />
        {home.video ? (
          // biome-ignore lint/a11y/useMediaCaption: a walk through a home has no speech to caption
          <video
            src={home.video.url}
            poster={home.video.posterUrl ?? undefined}
            controls
            preload="none"
            className="w-full rounded-lg bg-default"
          />
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Your fee</span>
            <span className="text-xs text-muted">{feeTermsWords(home.fee)}, paid by the landlord</span>
          </span>
          <span className="text-lg font-semibold tabular">{formatMoney(home.feeRwf)}</span>
        </div>

        <KeyValueList items={facts} />

        <section aria-labelledby="landlord-h" className="flex flex-col gap-3 border-t border-border pt-4">
          <SectionHeader id="landlord-h" title="Landlord" />
          {home.contact ? (
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-medium">{home.contact.name ?? home.landlordName}</span>
              <span className="flex flex-wrap gap-2">
                {home.contact.phone ? (
                  <ActionLink href={`tel:${home.contact.phone}`} icon="Handset" size="sm">
                    {home.contact.phone}
                  </ActionLink>
                ) : null}
                {home.contact.email ? (
                  <ActionLink href={`mailto:${home.contact.email}`} icon="Envelope" size="sm">
                    {home.contact.email}
                  </ActionLink>
                ) : null}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted">Call the landlord before you bring a tenant.</span>
              <ActionButton icon="Eye" onPress={reveal} isPending={revealing}>
                Reveal contact
              </ActionButton>
            </div>
          )}
        </section>
      </SidePanel>

      {placing ? (
        <PlacementDialog
          home={home}
          onClose={() => setPlacing(false)}
          onDone={(placement) => {
            setPlacing(false);
            setHome((h) => ({ ...h, placement: { id: placement.id, status: placement.status } }));
            toast.success(`Placement started. ${home.landlordName} has been told.`);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function PlacementDialog({
  home,
  onClose,
  onDone,
}: {
  home: BrokerHome;
  onClose: () => void;
  onDone: (p: { id: string; status: "initiated" | "converted" | "abandoned" | "unavailable" }) => void;
}) {
  const [tenantName, setTenantName] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`A tenant for ${home.unitLabel}`}
      description={`${home.landlordName} is told and names you on the lease.`}
      submitLabel="Start placement"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const r = await startPlacement(home.unitId, {
            tenantName: tenantName.trim() || null,
            note: note.trim() || null,
          });
          if (!r.ok) {
            setErrors(fieldErrorsOnly(r.fieldErrors));
            setFormError(r.fieldErrors ? null : r.error);
            return;
          }
          onDone(r.value);
        });
      }}
    >
      <TextInput
        label="Tenant's name"
        name="tenantName"
        value={tenantName}
        onChange={setTenantName}
        description="Optional."
      />
      <TextInput
        label="Note to the landlord"
        name="note"
        value={note}
        onChange={setNote}
        multiline
        description="Optional."
      />
    </FormDialog>
  );
}
