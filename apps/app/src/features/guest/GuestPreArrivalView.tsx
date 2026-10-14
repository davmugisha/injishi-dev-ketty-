"use client";

import {
  ArrowUpFromLine,
  Camera,
  Check,
  CircleCheckFill,
  CircleInfo,
  Lock,
  PaperPlane,
  Pencil,
  TrashBin,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Tag,
  TagGroup,
  TextArea,
  TextField,
} from "@heroui/react";
import { DropZone, ItemCard, ListView, RadioButtonGroup, Stepper } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  ArrivalSlot,
  GuestBooking,
  GuestOption,
  IdDocumentType,
  IdPrivacyPoint,
  PreArrivalForm,
  PreArrivalNextStep,
} from "@injishi/data/fixtures/guest";
import { Icon, LinkButton, PhoneBody, toneColor } from "@injishi/ui";
import { useState } from "react";
import {
  BackLink,
  CardHeading,
  ChevronLink,
  GuestTimeline,
  GuestTop,
  IconRow,
  IconTile,
  StepHeading,
  useGuestLang,
  WideSwitch,
} from "./parts";

export type PreArrivalStep = "id" | "arrival" | "preferences" | "contact" | "done";

const ORDER: PreArrivalStep[] = ["id", "arrival", "preferences", "contact", "done"];
const STEP_LABELS = [
  { id: "id", label: "ID" },
  { id: "arrival", label: "Arrival" },
  { id: "preferences", label: "Preferences" },
  { id: "contact", label: "Contact" },
] as const;

const TITLES = {
  en: "Pre-arrival check-in",
  rw: "Kwiyandikisha mbere yo kuhagera",
  fr: "Enregistrement anticipé",
} as const;

export interface GuestPreArrivalData {
  booking: GuestBooking;
  form: PreArrivalForm;
  documents: IdDocumentType[];
  privacy: IdPrivacyPoint[];
  slots: ArrivalSlot[];
  travelModes: GuestOption[];
  pillows: GuestOption[];
  diets: GuestOption[];
  countries: GuestOption[];
  next: PreArrivalNextStep[];
}

/** Guest · pre-arrival check-in: ID, arrival, preferences, contact, then what happens next. */
export function GuestPreArrivalView({ data, step: initial }: { data: GuestPreArrivalData; step: PreArrivalStep }) {
  const { booking, form, documents, privacy, slots, travelModes, pillows, diets, countries, next } = data;
  const [lang, setLang] = useGuestLang();
  const [step, setStep] = useState<PreArrivalStep | null>(null);
  const [doc, setDoc] = useState(form.document);
  const [file, setFile] = useState<boolean | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [slot, setSlot] = useState(form.slot);
  const [travel, setTravel] = useState(form.travel);
  const [plate, setPlate] = useState(form.plate);
  const [pillow, setPillow] = useState(form.pillow);
  const [dietOn, setDietOn] = useState<string[]>(form.diets);
  const [note, setNote] = useState("");
  const [keep, setKeep] = useState(form.remember);
  const [name, setName] = useState(form.fullName);
  const [phone, setPhone] = useState(form.phone);
  const [email, setEmail] = useState(form.email);
  const [country, setCountry] = useState(form.country);

  const current = step ?? initial;
  const idx = ORDER.indexOf(current);
  const hasFile = file !== null ? file : !skipped && idx > 0;
  const docType = documents.find((d) => d.id === doc) ?? documents[0];
  const countryName = countries.find((c) => c.id === country)?.label ?? form.issuedBy;
  const docName = `${docType.label} · ${countryName}`;
  const chosenSlot = slots.find((s) => s.id === slot) ?? slots[0];
  const travelLabel = (travelModes.find((t) => t.id === travel)?.label ?? travel).toLowerCase();
  const pillowLabel = pillows.find((p) => p.id === pillow)?.label ?? pillow;
  const prefBits = [`${pillowLabel} pillow`, ...diets.filter((d) => dietOn.includes(d.id)).map((d) => d.label)];

  const summary = [
    hasFile
      ? {
          id: "id",
          icon: "Passport",
          label: "ID",
          value: `${docName} · ending ${form.documentEnding}`,
          chip: "Desk to review",
          tone: "default" as const,
          step: "id" as const,
        }
      : {
          id: "id",
          icon: "Passport",
          label: "ID",
          value: "Not sent. Bring it to the desk.",
          chip: "At the desk",
          tone: "warning" as const,
          step: "id" as const,
        },
    {
      id: "arrival",
      icon: "Clock",
      label: "Arrival",
      value: `${booking.checkIn.day}, ${chosenSlot.label} · ${travelLabel}`,
      chip: "Shared",
      tone: "default" as const,
      step: "arrival" as const,
    },
    {
      id: "preferences",
      icon: "Moon",
      label: "Preferences",
      value: prefBits.join(" · "),
      chip: keep ? "Saved" : "This stay",
      tone: "default" as const,
      step: "preferences" as const,
    },
    {
      id: "contact",
      icon: "Handset",
      label: "Contact",
      value: `${phone} · email`,
      chip: "Shared",
      tone: "default" as const,
      step: "contact" as const,
    },
  ];

  return (
    <>
      <GuestTop
        lead={<BackLink href={screenHref("GuestTrip")} label="Back to your trip" />}
        title={TITLES[lang]}
        sub={`${booking.shortName} · ${booking.id}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        {current !== "done" ? (
          <Stepper
            orientation="horizontal"
            size="sm"
            currentStep={idx}
            onStepChange={(i) => {
              const nextStep = ORDER[i];
              if (nextStep && nextStep !== "done") setStep(nextStep);
            }}
            aria-label="Pre-arrival steps"
            className="w-full shrink-0"
          >
            {STEP_LABELS.map((s) => (
              <Stepper.Step key={s.id}>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>{s.label}</Stepper.Title>
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>
            ))}
          </Stepper>
        ) : null}

        {current === "id" ? (
          <section aria-labelledby="id-h" className="flex shrink-0 flex-col gap-[14px]">
            <StepHeading
              id="id-h"
              title="Add your ID"
              sub="The hotel registers everyone who stays. Send yours now and the desk only has to compare it with the original."
            />
            <TagGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[doc]}
              onSelectionChange={(keys) => {
                const k = [...keys][0];
                if (k) setDoc(String(k));
              }}
              className="flex flex-col gap-[6px]"
            >
              <Label id="doc-l">Document</Label>
              <TagGroup.List aria-labelledby="doc-l" className="flex flex-wrap gap-[6px]">
                {documents.map((d) => (
                  <Tag key={d.id} id={d.id}>
                    {d.label}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>

            <DropZone>
              {hasFile ? (
                <DropZone.FileList>
                  <DropZone.FileItem status="complete">
                    <IconTile name="Passport" />
                    <DropZone.FileInfo>
                      <DropZone.FileName>{docName}</DropZone.FileName>
                      <DropZone.FileMeta className="tabular">
                        Number ending {form.documentEnding} · photo {form.photoSize}
                      </DropZone.FileMeta>
                      <Chip size="sm" variant="soft" className="mt-1 self-start">
                        <Lock className="size-3" />
                        <Chip.Label>Uploaded · encrypted · waiting for desk review</Chip.Label>
                      </Chip>
                    </DropZone.FileInfo>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      aria-label="Remove and choose another photo"
                      onPress={() => setFile(false)}
                    >
                      <TrashBin className="size-4" />
                    </Button>
                  </DropZone.FileItem>
                </DropZone.FileList>
              ) : (
                <DropZone.Area className="px-4 py-[22px]">
                  <DropZone.Icon>
                    <Camera className="size-7" />
                  </DropZone.Icon>
                  <DropZone.Label>{docType.prompt}</DropZone.Label>
                  <DropZone.Description>JPG, PNG or PDF · up to 10 MB · all four corners visible</DropZone.Description>
                  <DropZone.Trigger onPress={() => setFile(true)}>
                    <ArrowUpFromLine className="size-4" />
                    Take or choose a photo
                  </DropZone.Trigger>
                </DropZone.Area>
              )}
            </DropZone>

            <Card variant="secondary" aria-labelledby="priv-h" className="gap-3 px-4 py-3.5">
              <h2 id="priv-h" className="text-[14px] leading-5 font-semibold">
                How your ID is used
              </h2>
              {privacy.map((p) => (
                <IconRow key={p.id} icon={p.icon} title={p.title} text={p.text} />
              ))}
              <ChevronLink href={screenHref("GuestAccount")}>
                Ask for a copy, correction or deletion in your account
              </ChevronLink>
            </Card>

            {form.companions.map((c) => (
              <ItemCard key={c.id} variant="outline">
                <ItemCard.Icon>
                  <Icon name="Person" />
                </ItemCard.Icon>
                <ItemCard.Content>
                  <ItemCard.Title>{c.label}</ItemCard.Title>
                  <ItemCard.Description className="whitespace-normal">{c.note}</ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action>
                  <Chip size="sm" variant="soft">
                    {c.status}
                  </Chip>
                </ItemCard.Action>
              </ItemCard>
            ))}

            <div className="flex flex-col gap-2">
              <Button size="lg" fullWidth isDisabled={!hasFile} onPress={() => setStep("arrival")}>
                Continue
              </Button>
              {!hasFile ? (
                <span className="text-center text-[12px] text-muted">Add a photo to continue, or skip this step.</span>
              ) : null}
              <Button
                variant="ghost"
                fullWidth
                onPress={() => {
                  setSkipped(true);
                  setFile(false);
                  setStep("arrival");
                }}
              >
                Skip, I’ll show it at the desk
              </Button>
            </div>
          </section>
        ) : null}

        {current === "arrival" ? (
          <section aria-labelledby="arr-h" className="flex shrink-0 flex-col gap-[14px]">
            <StepHeading
              id="arr-h"
              title="When will you arrive?"
              sub="Wednesday 14 October. Check-in is from 14:00 and the front desk is open 24 hours."
            />
            <RadioButtonGroup
              aria-label="Expected arrival time"
              value={slot}
              onChange={(v) => {
                if (v) setSlot(String(v));
              }}
              layout="grid"
              className="grid grid-cols-2 gap-2"
            >
              {slots.map((a) => (
                <RadioButtonGroup.Item key={a.id} value={a.id} className="items-start px-3.5 py-3 text-left">
                  <RadioButtonGroup.Indicator>
                    <CircleCheckFill className="size-4" />
                  </RadioButtonGroup.Indicator>
                  <RadioButtonGroup.ItemContent className="flex flex-col gap-0.5">
                    <span className="font-semibold tabular">{a.label}</span>
                    <span className="text-[12px] leading-4 text-muted">{a.hint}</span>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              ))}
            </RadioButtonGroup>
            {chosenSlot.noteTitle ? (
              <Alert>
                <Alert.Indicator>
                  <CircleInfo />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>{chosenSlot.noteTitle}</Alert.Title>
                  <Alert.Description>{chosenSlot.noteText}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            <TagGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[travel]}
              onSelectionChange={(keys) => {
                const k = [...keys][0];
                if (k) setTravel(String(k));
              }}
              className="flex flex-col gap-[6px]"
            >
              <Label id="how-l">How are you travelling?</Label>
              <TagGroup.List aria-labelledby="how-l" className="flex flex-wrap gap-[6px]">
                {travelModes.map((tv) => (
                  <Tag key={tv.id} id={tv.id}>
                    {tv.label}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
            {travel === "car" ? (
              <TextField fullWidth value={plate} onChange={setPlate} className="gap-1">
                <Label>Plate number (optional)</Label>
                <Input className="tabular" />
                <Description>Only used for the hotel car park list. Deleted after checkout.</Description>
              </TextField>
            ) : null}
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" className="flex-1" onPress={() => setStep("id")}>
                Back
              </Button>
              <Button size="lg" className="flex-[2]" onPress={() => setStep("preferences")}>
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {current === "preferences" ? (
          <section aria-labelledby="pref-h" className="flex shrink-0 flex-col gap-[14px]">
            <StepHeading
              id="pref-h"
              title="Make the room yours"
              sub="These are requests, not promises. The desk confirms what’s possible when you check in."
            />
            <TagGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[pillow]}
              onSelectionChange={(keys) => {
                const k = [...keys][0];
                if (k) setPillow(String(k));
              }}
              className="flex flex-col gap-[6px]"
            >
              <Label id="pil-l">Pillow</Label>
              <TagGroup.List aria-labelledby="pil-l" className="flex flex-wrap gap-[6px]">
                {pillows.map((p) => (
                  <Tag key={p.id} id={p.id}>
                    {p.label}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
            <TagGroup
              selectionMode="multiple"
              selectedKeys={dietOn}
              onSelectionChange={(keys) => setDietOn([...keys].map(String))}
              className="flex flex-col gap-[6px]"
            >
              <Label id="diet-l">Dietary needs</Label>
              <TagGroup.List aria-labelledby="diet-l" className="flex flex-wrap gap-[6px]">
                {diets.map((d) => (
                  <Tag key={d.id} id={d.id}>
                    {d.label}
                  </Tag>
                ))}
              </TagGroup.List>
              <Description>
                Allergies go to the Isangano Terrace kitchen with your orders. Please tell your server too.
              </Description>
            </TagGroup>
            <TextField fullWidth value={note} onChange={setNote} className="gap-1">
              <Label>Anything else?</Label>
              <TextArea rows={3} placeholder="Celebrating something? Travelling with a baby?" />
            </TextField>
            <Card variant="secondary" className="gap-2 px-4 py-3.5">
              <WideSwitch isSelected={keep} onChange={setKeep}>
                Remember these for future stays
              </WideSwitch>
              <p className="text-[12px] leading-[17px] text-muted">
                {keep
                  ? "Saved to your guest profile with Amahoro Hospitality’s hotels, so Isangano and Ishyamba can prepare them next time. Turn this off any time in your account."
                  : "Used for this stay only and removed after checkout."}
              </p>
            </Card>
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" className="flex-1" onPress={() => setStep("arrival")}>
                Back
              </Button>
              <Button size="lg" className="flex-[2]" onPress={() => setStep("contact")}>
                Continue
              </Button>
            </div>
          </section>
        ) : null}

        {current === "contact" ? (
          <section aria-labelledby="con-h" className="flex shrink-0 flex-col gap-[14px]">
            <StepHeading
              id="con-h"
              title="How can we reach you?"
              sub="For this stay only: room ready, requests and your bill."
            />
            <TextField fullWidth value={name} onChange={setName} className="gap-1">
              <Label>Full name, as on your ID</Label>
              <Input />
            </TextField>
            <TextField fullWidth value={phone} onChange={setPhone} className="gap-1">
              <Label>Mobile number</Label>
              <Input type="tel" className="tabular" />
            </TextField>
            <TextField fullWidth value={email} onChange={setEmail} className="gap-1">
              <Label>Email</Label>
              <Input type="email" />
            </TextField>
            <Select
              fullWidth
              value={country}
              onChange={(k) => {
                if (k != null) setCountry(String(k));
              }}
              className="gap-1"
            >
              <Label>Country of residence</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {countries.map((c) => (
                    <ListBox.Item key={c.id} id={c.id} textValue={c.label}>
                      {c.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <ItemCard variant="secondary">
              <ItemCard.Icon>
                <Icon name="Bell" />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>Updates in the app and by email</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">
                  You can add SMS or WhatsApp from Requests after check-in.
                </ItemCard.Description>
              </ItemCard.Content>
            </ItemCard>
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" className="flex-1" onPress={() => setStep("preferences")}>
                Back
              </Button>
              <Button size="lg" className="flex-[2]" onPress={() => setStep("done")}>
                <PaperPlane className="size-4" />
                Send to the hotel
              </Button>
            </div>
          </section>
        ) : null}

        {current === "done" ? (
          <section aria-labelledby="done-h" className="flex shrink-0 flex-col gap-4">
            <div className="flex flex-col items-center gap-1.5 px-2 pt-3 text-center">
              <span className="inline-flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-7" />
              </span>
              <h1 id="done-h" className="text-[22px] leading-7 font-semibold">
                Sent to {booking.shortName}
              </h1>
              <p className="text-[13px] leading-[18px] text-muted">
                Received {form.receivedAt}. You can change anything until you check in.
              </p>
            </div>
            <Alert status="accent">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>The front desk will still check your ID when you arrive</Alert.Title>
                <Alert.Description>
                  Pre-arrival check-in and linking your booking speed things up, but they don’t prove who you are. Bring
                  the original document.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <ListView aria-label="Your answers" items={summary}>
              {(r) => (
                <ListView.Item id={r.id} textValue={r.label}>
                  <ListView.ItemContent>
                    <Icon name={r.icon} className="size-4 shrink-0 text-muted" />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title>{r.label}</ListView.Title>
                      <ListView.Description className="whitespace-normal">{r.value}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction className="flex items-center gap-1.5">
                    <Chip size="sm" variant="soft" color={toneColor(r.tone)}>
                      {r.chip}
                    </Chip>
                    <Button
                      variant="ghost"
                      size="sm"
                      isIconOnly
                      aria-label={`Edit ${r.label}`}
                      onPress={() => setStep(r.step)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
            <section aria-labelledby="next-h" className="flex flex-col gap-2.5 rounded-2xl border border-separator p-4">
              <CardHeading id="next-h">What Happens Next</CardHeading>
              <GuestTimeline items={next} />
            </section>
            <LinkButton href={screenHref("GuestTrip")} size="lg" fullWidth>
              Back to my trip
            </LinkButton>
          </section>
        ) : null}
      </PhoneBody>
    </>
  );
}
