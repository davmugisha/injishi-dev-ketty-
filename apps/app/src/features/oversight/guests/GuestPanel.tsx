"use client";

import { Description, FieldError, Label, TextArea, TextField, toast } from "@heroui/react";
import { ID_KIND_LABEL, type LeaderGuest } from "@injishi/contracts";
import { ActionButton, FormDialog, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { flagGuest, markGuestSeen } from "./actions";
import { ChainList, GuestStatusChip, phoneWords, stayWords } from "./parts";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** Label and value rows with one label width for the whole panel, so every section lines up. */
function Facts({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="flex flex-col gap-2 text-sm">
      {items.map((it) => (
        <div key={it.label} className="flex gap-4">
          <dt className="w-28 shrink-0 text-muted">{it.label}</dt>
          <dd className="min-w-0 flex-1 font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Flag a guest for a closer look: a note the rest of the chain reads. */
function FlagDialog({
  guest,
  isOpen,
  onOpenChange,
  onFlagged,
}: {
  guest: LeaderGuest;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onFlagged: (g: LeaderGuest) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setError(null);
          setNote("");
        }
        onOpenChange(open);
      }}
      title={`Flag ${guest.fullName}`}
      description="Everyone in this guest's chain sees the note. The host does not."
      submitLabel="Flag guest"
      submitIcon="Flag"
      isPending={pending}
      validationErrors={error ? { note: error } : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          const result = await flagGuest(guest.id, note);
          if (!result.ok) {
            setError(result.fieldErrors?.note ?? result.error);
            return;
          }
          toast.success("Guest flagged");
          setNote("");
          onFlagged(result.value);
          onOpenChange(false);
        });
      }}
    >
      <TextField
        name="note"
        value={note}
        onChange={setNote}
        isInvalid={error ? true : undefined}
        fullWidth
        className="gap-1"
      >
        <Label>What needs a closer look</Label>
        <TextArea rows={4} placeholder="Stays longer than registered, not the person named, ..." />
        <Description>3 to 500 characters.</Description>
        <FieldError>{error}</FieldError>
      </TextField>
    </FormDialog>
  );
}

/**
 * One guest in the leader's area: who, from where, staying with whom and where, the dates, and the chain
 * with who opened it. Opening it marks it seen on the leader's own step; Flag asks for a note.
 */
export function GuestPanel({ guest: initial, onClose }: { guest: LeaderGuest; onClose: () => void }) {
  const router = useRouter();
  const [guest, setGuest] = useState(initial);
  const [flagging, setFlagging] = useState(false);
  const marked = useRef(false);

  useEffect(() => setGuest(initial), [initial]);

  // Opening is reading: the leader's own step records it, once.
  useEffect(() => {
    if (marked.current || initial.seenByMe) return;
    marked.current = true;
    void markGuestSeen(initial.id).then((result) => {
      if (result.ok) {
        setGuest(result.value);
        router.refresh();
      }
    });
  }, [initial.id, initial.seenByMe, router]);

  const id = guest.idKind && guest.idNumber ? `${ID_KIND_LABEL[guest.idKind]} ${guest.idNumber}` : "Not given";
  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(open) => (open ? undefined : onClose())}
        title={guest.fullName}
        description={`${guest.nationalityName}${guest.fromAbroad ? ", from abroad" : ""}`}
        headerExtra={<GuestStatusChip guest={guest} />}
        footer={
          <>
            <ActionButton onPress={onClose}>Close</ActionButton>
            <ActionButton icon="Flag" intent="danger-soft" onPress={() => setFlagging(true)}>
              {guest.flagged ? "Add a flag note" : "Flag"}
            </ActionButton>
          </>
        }
      >
        <Section title="Stay">
          <Facts
            items={[
              { label: "Dates", value: stayWords(guest) },
              { label: "Coming from", value: guest.originWords },
              { label: "Relationship", value: guest.relationshipLabel },
              ...(guest.changedAt ? [{ label: "Changed", value: "The host changed the details after filing" }] : []),
            ]}
          />
        </Section>
        <Section title="Guest">
          <Facts
            items={[
              {
                label: "Phone",
                value: (
                  <a className="underline-offset-2 hover:underline" href={`tel:${guest.phone}`}>
                    {phoneWords(guest.phone)}
                  </a>
                ),
              },
              { label: "ID", value: id },
              { label: "Nationality", value: guest.nationalityName },
            ]}
          />
        </Section>
        <Section
          title={
            guest.host.kind === "tenant"
              ? "Staying with the tenant"
              : guest.host.kind === "stay"
                ? "Staying at"
                : "Staying with the landlord"
          }
        >
          <Facts
            items={[
              { label: "Host", value: guest.host.name },
              ...(guest.host.phone
                ? [
                    {
                      label: "Host phone",
                      value: (
                        <a className="underline-offset-2 hover:underline" href={`tel:${guest.host.phone}`}>
                          {phoneWords(guest.host.phone)}
                        </a>
                      ),
                    },
                  ]
                : []),
              {
                label: "Home",
                value: guest.home.unitLabel
                  ? `${guest.home.propertyName}, unit ${guest.home.unitLabel}`
                  : guest.home.propertyName,
              },
              { label: "Address", value: guest.home.address },
            ]}
          />
        </Section>
        <Section title="Where it has been">
          <ChainList guest={guest} />
        </Section>
      </SidePanel>
      <FlagDialog
        guest={guest}
        isOpen={flagging}
        onOpenChange={setFlagging}
        onFlagged={(g) => {
          setGuest(g);
          router.refresh();
        }}
      />
    </>
  );
}
