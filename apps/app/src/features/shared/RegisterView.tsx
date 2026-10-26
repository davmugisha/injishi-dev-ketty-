"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  CircleInfo,
  CircleQuestion,
  CloudCheck,
  FileArrowUp,
  LifeRing,
  Lock,
  MapPin,
  PaperPlane,
  Pencil,
  PersonMagnifier,
  ShieldCheck,
  ShieldExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  Radio,
  RadioGroup,
  Spinner,
  Switch,
  TextField,
} from "@heroui/react";
import { DropZone, ListView, Navbar, RadioButtonGroup, Stepper } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  AcquisitionChannel,
  BusinessType,
  ProcessStep,
  RegistrationApplication,
  RegistrationDocument,
  RegistrationField,
  RegistrationStep,
  TinCheck,
  Tone,
  UploadStatus,
} from "@injishi/data/fixtures/shared";
import { GateChip, Icon, KeyValueList, LinkButton, toneColor } from "@injishi/ui";
import { useState } from "react";
import { CardHeading, ChoiceSelect, IconNote, IconTile, ProcessTimeline, PublicBar } from "./ui";

interface RegisterData {
  application: RegistrationApplication;
  types: BusinessType[];
  steps: RegistrationStep[];
  documents: RegistrationDocument[];
  channels: AcquisitionChannel[];
  classFields: RegistrationField[];
  geoFields: RegistrationField[];
  fees: ProcessStep[];
  claim: ProcessStep[];
  after: ProcessStep[];
}

const FILE_CHIP: Record<UploadStatus, { label: string; tone: "success" | "danger" | "warning" | "default" }> = {
  complete: { label: "Uploaded", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  missing: { label: "Missing", tone: "warning" },
  uploading: { label: "Optional · uploading", tone: "default" },
};

const WHO = [
  {
    id: "owner",
    label: "I own or direct this business",
    desc: "You submit it yourself and pay after approval.",
    icon: "Person" as const,
  },
  {
    id: "agent",
    label: "I’m a field agent registering for the owner",
    desc: "The owner claims it, checks every detail and submits.",
    icon: "PersonWorker" as const,
  },
];

/** Business registration (artifact: Register.dc.html). `?tin=` selects the TIN-check result. */
export function RegisterView({ tin, data }: { tin: TinCheck; data: RegisterData }) {
  const app = data.application;
  const [step, setStep] = useState(1);
  const [typeId, setTypeId] = useState(data.types[0]?.id ?? "hotel");
  const [channel, setChannel] = useState(data.channels[0]?.id ?? "agent");
  const [who, setWho] = useState("owner");
  const [files, setFiles] = useState<Record<string, UploadStatus>>(() =>
    Object.fromEntries(data.documents.map((d) => [d.id, d.status])),
  );
  const [manual, setManual] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(`Draft saved · ${app.savedAt}`);
  const [vat, setVat] = useState(app.vatRegistered);
  const [agreed, setAgreed] = useState(true);

  const type = data.types.find((t) => t.id === typeId) ?? data.types[0];
  const tinLive: TinCheck = checking ? "verifying" : tin;
  const tinChip =
    tinLive === "matched"
      ? "Matched"
      : tinLive === "verifying"
        ? "Checking…"
        : manual
          ? "Manual review"
          : "Not verified";
  const tinTone: Tone = tinLive === "matched" ? "success" : tinLive === "verifying" ? "default" : "warning";
  const fileStatus = (id: string, fallback: UploadStatus) => files[id] ?? fallback;
  const docsOk = fileStatus("licence", "failed") === "complete" && fileStatus("id", "missing") === "complete";
  const docsLeft =
    (fileStatus("licence", "failed") === "complete" ? 0 : 1) + (fileStatus("id", "missing") === "complete" ? 0 : 1);
  const channelRow = data.channels.find((c) => c.id === channel);
  const channelLabel = channel === "agent" ? `Field agent ${app.agent.code}` : (channelRow?.label ?? "");
  const isAgent = who === "agent";
  const touch = (fn: () => void) => {
    setSaved("Draft saved · just now");
    fn();
  };

  const stepDesc = (id: RegistrationStep["id"]) => {
    if (id === "type") return type?.label ?? "";
    if (id === "tin") return `TIN gate · ${tinChip}`;
    if (id === "documents") return docsOk ? "Required documents uploaded" : `${docsLeft} need attention`;
    if (id === "channel") return channelLabel;
    if (id === "ownership") return isAgent ? "Field agent · owner claims" : "Registering as owner";
    if (id === "review") return submitted ? (isAgent ? "Claim link sent" : "Submitted for review") : "Not submitted";
    return data.steps.find((s) => s.id === id)?.desc ?? "";
  };
  const stepDone = (id: RegistrationStep["id"]) => {
    if (id === "tin") return tinLive === "matched" || manual;
    if (id === "documents") return docsOk;
    if (id === "review") return submitted;
    return true;
  };

  const review = [
    { id: "type", title: "Business type", value: type?.label ?? "", chip: "Done", tone: "success" as const, goto: 0 },
    {
      id: "tin",
      title: "Legal entity & TIN",
      value: `${app.entity} · TIN ${app.tin}`,
      chip: tinChip,
      tone: tinTone,
      goto: 1,
    },
    {
      id: "class",
      title: "Classification & licences",
      value: `${type?.label ?? ""} · licence ${app.licence} · EAC ${app.eacGrade}`,
      chip: "Done",
      tone: "success" as const,
      goto: 2,
    },
    { id: "location", title: "Location", value: app.locationShort, chip: "Done", tone: "success" as const, goto: 3 },
    {
      id: "documents",
      title: "Documents",
      value: docsOk ? "All required documents uploaded" : "Tourism licence upload failed · owner ID missing",
      chip: docsOk ? "Done" : "Needs attention",
      tone: docsOk ? ("success" as const) : ("warning" as const),
      goto: 4,
    },
    {
      id: "fee",
      title: "Registration fee",
      value: `${app.fee} · charged after approval`,
      chip: "Pending approval",
      tone: "default" as const,
      goto: 5,
    },
    { id: "channel", title: "How you found us", value: channelLabel, chip: "Done", tone: "success" as const, goto: 6 },
    {
      id: "ownership",
      title: "Ownership",
      value: isAgent ? `Prepared by field agent ${app.agent.code} for ${app.owner.name}` : `${app.owner.name}, owner`,
      chip: "Done",
      tone: "success" as const,
      goto: 7,
    },
  ];

  let submitBlocked = false;
  let submitWhy = "Injishi staff usually review within 2 business days. You can’t edit while it is under review.";
  if (isAgent) submitWhy = "The owner receives a claim link. Only they can submit for review.";
  else if (tinLive === "verifying") {
    submitBlocked = true;
    submitWhy = "Wait for the TIN check to finish.";
  } else if (!docsOk) {
    submitBlocked = true;
    submitWhy = "Fix the tourism licence upload and add the owner’s national ID first.";
  }
  const submitLabel = isAgent ? "Send claim link to owner" : "Submit for review";
  const appChip = submitted ? (isAgent ? "Waiting for owner claim" : "In review") : "Draft · not submitted";
  const preparedBy = isAgent ? `Field agent ${app.agent.code} for ${app.owner.name}` : `${app.owner.name}, owner`;
  const cur = data.steps[step];

  return (
    <>
      <PublicBar maxWidth={1240}>
        <span className="text-muted" aria-hidden="true">
          /
        </span>
        <span className="font-semibold">Register a business</span>
        <Navbar.Spacer />
        <Chip variant="soft" role="status">
          <CloudCheck className="size-3.5" />
          <Chip.Label>{saved}</Chip.Label>
        </Chip>
        <LinkButton href={screenHref("Main")} variant="ghost" size="sm">
          Save and exit
        </LinkButton>
        <LinkButton
          href={screenHref("PublicHelp")}
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label="Help with registration"
        >
          <CircleQuestion className="size-4" />
        </LinkButton>
      </PublicBar>

      <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-4 pt-6 pb-12 sm:px-8">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] leading-[18px] font-medium text-muted">
            Application {app.id} · started {app.started}
          </p>
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.015em]">Register {app.business}</h1>
          <p className="text-sm text-muted">
            Injishi staff review every registration. Nothing goes live on paperwork alone.
          </p>
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <nav aria-label="Registration steps" className="w-full min-w-0 shrink-0 sm:w-[250px]">
            <Stepper orientation="vertical" currentStep={step} onStepChange={setStep} aria-label="Registration steps">
              {data.steps.map((s, i) => (
                <Stepper.Step key={s.id}>
                  <Stepper.Indicator>
                    {stepDone(s.id) && i !== step ? <Check className="size-3.5" /> : i + 1}
                  </Stepper.Indicator>
                  <Stepper.Content>
                    <Stepper.Title>{s.title}</Stepper.Title>
                    <Stepper.Description>{stepDesc(s.id)}</Stepper.Description>
                  </Stepper.Content>
                  <Stepper.Separator />
                </Stepper.Step>
              ))}
            </Stepper>
          </nav>

          <section
            aria-labelledby="step-h"
            className="flex min-w-0 flex-[1_1_520px] flex-col gap-5 rounded-2xl bg-surface p-6 shadow-surface"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-muted">
                Step {step + 1} of {data.steps.length}
              </span>
              <h2 id="step-h" className="text-xl leading-7 font-semibold tracking-[-0.01em]">
                {cur?.title}
              </h2>
              <p className="text-sm text-muted">{cur?.lead}</p>
            </div>

            {step === 0 && type ? (
              <>
                <RadioButtonGroup
                  aria-label="Business type"
                  value={typeId}
                  onChange={(v) => v && touch(() => setTypeId(String(v)))}
                  layout="grid"
                  className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(165px,100%),1fr))]"
                >
                  {data.types.map((b) => (
                    <RadioButtonGroup.Item key={b.id} value={b.id} className="items-start gap-2 px-4 py-3.5 text-left">
                      <RadioButtonGroup.Indicator>
                        <CircleCheck className="size-4" />
                      </RadioButtonGroup.Indicator>
                      <Icon name={b.icon} className="size-5" />
                      <RadioButtonGroup.ItemContent className="flex flex-col gap-0.5">
                        <span className="font-semibold">{b.label}</span>
                        <span className="text-xs leading-4 text-muted">{b.desc}</span>
                      </RadioButtonGroup.ItemContent>
                    </RadioButtonGroup.Item>
                  ))}
                </RadioButtonGroup>
                <Alert>
                  <Alert.Indicator>
                    <CircleInfo />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{type.label}</Alert.Title>
                    <Alert.Description>{type.note}</Alert.Description>
                  </Alert.Content>
                </Alert>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]">
                  <ChoiceSelect
                    id="rg-form"
                    label="Legal form"
                    options={app.legalForms}
                    value={app.legalForm}
                    onChange={() => touch(() => undefined)}
                  />
                  <TextField fullWidth defaultValue={app.entity} className="gap-1">
                    <Label htmlFor="rg-name">Registered name</Label>
                    <Input id="rg-name" />
                    <Description>Exactly as on your RDB certificate</Description>
                  </TextField>
                  <TextField fullWidth defaultValue={app.business} className="gap-1">
                    <Label htmlFor="rg-trade">Trading name</Label>
                    <Input id="rg-trade" />
                    <Description>The name guests see</Description>
                  </TextField>
                  <TextField fullWidth defaultValue={app.tin} isInvalid={tinLive === "not_verified"} className="gap-1">
                    <Label htmlFor="rg-tin">Tax identification number (TIN)</Label>
                    <div className="flex gap-2">
                      <Input id="rg-tin" inputMode="numeric" className="min-w-0 flex-1 tabular" />
                      <Button
                        variant="secondary"
                        onPress={() => {
                          setChecking(true);
                          window.setTimeout(() => setChecking(false), 1800);
                        }}
                      >
                        Check again
                      </Button>
                    </div>
                    <Description>9 digits from your RRA registration</Description>
                  </TextField>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Switch isSelected={vat} onChange={setVat}>
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      Registered for VAT
                    </Switch.Content>
                  </Switch>
                  <GateChip icon={<ShieldExclamation className="size-3" />}>
                    Registry connection needs verification
                  </GateChip>
                </div>
                {tinLive === "verifying" ? (
                  <div role="status" className="flex items-start gap-3 rounded-2xl bg-surface-secondary px-4 py-3.5">
                    <Spinner size="sm" color="accent" aria-hidden="true" className="mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold">Checking TIN {app.tin}…</span>
                      <span className="text-[13px] text-muted">
                        Usually under a minute. You can keep going; the result appears here and on the review step.
                      </span>
                    </div>
                  </div>
                ) : null}
                {tinLive === "matched" ? (
                  <>
                    <Alert status="success" role="status">
                      <Alert.Indicator>
                        <CircleCheck />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>TIN matched</Alert.Title>
                        <Alert.Description>
                          The name and TIN agree with the taxpayer registry. A match speeds up review; it does not
                          activate the business.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                    <KeyValueList
                      className="rounded-2xl bg-surface-secondary px-4 py-3"
                      items={[
                        { label: "Registry name", value: app.registry.name },
                        { label: "Name you entered", value: `${app.entity} · same` },
                        { label: "Taxpayer status", value: app.registry.status },
                        {
                          label: "Checked",
                          value: (
                            <span className="tabular">
                              {app.registry.checkedAt} · check ref {app.registry.ref}
                            </span>
                          ),
                        },
                      ]}
                    />
                  </>
                ) : null}
                {tinLive === "not_verified" ? (
                  <>
                    <Alert status="warning" role="status">
                      <Alert.Indicator>
                        <ShieldExclamation />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>We couldn’t verify this TIN</Alert.Title>
                        <Alert.Description>
                          The registry returned no match for {app.tin} with “{app.entity}”. You can continue: an Injishi
                          reviewer will check your RRA certificate by hand, and the business can’t be activated until
                          they confirm.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary">
                        <Pencil className="size-3.5" />
                        Edit TIN
                      </Button>
                      {manual ? (
                        <Chip size="sm" variant="soft" color="warning">
                          <PersonMagnifier className="size-3" />
                          <Chip.Label>Manual review requested · upload the RRA certificate in Documents</Chip.Label>
                        </Chip>
                      ) : (
                        <Button size="sm" onPress={() => touch(() => setManual(true))}>
                          Continue to manual review
                        </Button>
                      )}
                    </div>
                  </>
                ) : null}
                <IconNote icon={<Lock />}>
                  The TIN gate: no business is activated until its TIN is matched or a reviewer confirms it by hand.
                  Unverified details send the application to manual review; they never switch a business on.
                </IconNote>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]">
                  {data.classFields.map((f) => {
                    const value = f.id === "cl-class" ? (type?.label ?? "") : (f.value ?? "");
                    const options = f.id === "cl-class" ? data.types.map((t) => t.label) : f.options;
                    return (
                      <div key={f.id} className="flex flex-col gap-1">
                        {f.kind === "select" ? (
                          <ChoiceSelect
                            id={f.id}
                            label={f.label}
                            help={f.help}
                            value={value}
                            options={options}
                            onChange={() => touch(() => undefined)}
                            labelExtra={
                              f.optional ? (
                                <Chip size="sm" variant="soft">
                                  Optional
                                </Chip>
                              ) : null
                            }
                          />
                        ) : (
                          <TextField fullWidth defaultValue={value} className="gap-1">
                            <Label htmlFor={f.id}>{f.label}</Label>
                            <Input id={f.id} />
                            <Description>{f.help}</Description>
                          </TextField>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs leading-[17px] text-muted">
                  Classes come from the RDB class catalogue maintained by Injishi, version {app.catalogue}. A reviewer
                  checks them against your licence and certificates.
                </p>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]">
                  {data.geoFields.map((g) => (
                    <ChoiceSelect
                      key={g.id}
                      id={g.id}
                      label={g.label}
                      help={g.help}
                      value={g.value ?? ""}
                      options={g.options}
                      onChange={() => touch(() => undefined)}
                    />
                  ))}
                </div>
                <TextField fullWidth defaultValue={app.street} className="gap-1">
                  <Label htmlFor="rg-street">Street or landmark</Label>
                  <Input id="rg-street" />
                </TextField>
                <div
                  role="img"
                  aria-label="Map with a pin at the property"
                  className="flex h-[170px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-secondary text-sm text-muted"
                >
                  <MapPin className="size-5" aria-hidden="true" />
                  <span>Pin placed at {app.pin} · drag to adjust</span>
                </div>
                <p className="text-xs leading-[17px] text-muted">
                  Units come from Rwanda’s administrative reference list. Each list filters by the one above it:
                  province, district, sector, cell, village.
                </p>
              </>
            ) : null}

            {step === 4 ? (
              <DropZone>
                <DropZone.Area>
                  <DropZone.Icon>
                    <FileArrowUp className="size-7" />
                  </DropZone.Icon>
                  <DropZone.Label>Drop files here or browse</DropZone.Label>
                  <DropZone.Description>
                    PDF, JPG or PNG · up to 10 MB each · phone photos are fine if all four corners show
                  </DropZone.Description>
                  <DropZone.Trigger>Browse files</DropZone.Trigger>
                </DropZone.Area>
                <DropZone.Input accept="image/*,.pdf" />
                <DropZone.FileList>
                  {data.documents.map((f) => {
                    const status = fileStatus(f.id, f.status);
                    const chip = FILE_CHIP[status];
                    const meta = status === f.status ? f.meta : f.uploadedMeta;
                    const dz = status === "missing" ? undefined : status === "uploading" ? "uploading" : status;
                    return (
                      <DropZone.FileItem
                        key={f.id}
                        status={dz === "complete" || dz === "failed" || dz === "uploading" ? dz : undefined}
                      >
                        <IconTile icon={<Icon name={f.icon} />} size={36} />
                        <DropZone.FileInfo>
                          <DropZone.FileName>{f.doc}</DropZone.FileName>
                          <DropZone.FileMeta>{meta}</DropZone.FileMeta>
                          {status === "uploading" && f.progress != null ? (
                            <DropZone.FileProgress
                              value={f.progress}
                              aria-label={`Uploading ${f.doc}`}
                              size="sm"
                              color="accent"
                            >
                              <DropZone.FileProgressTrack>
                                <DropZone.FileProgressFill />
                              </DropZone.FileProgressTrack>
                            </DropZone.FileProgress>
                          ) : null}
                          {status === "failed" ? (
                            <DropZone.FileRetryTrigger
                              onClick={() => touch(() => setFiles((p) => ({ ...p, [f.id]: "complete" })))}
                            >
                              Try again with a smaller file
                            </DropZone.FileRetryTrigger>
                          ) : null}
                          {status === "missing" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="mt-1 self-start"
                              onPress={() => touch(() => setFiles((p) => ({ ...p, [f.id]: "complete" })))}
                            >
                              <FileArrowUp className="size-3.5" />
                              Upload
                            </Button>
                          ) : null}
                        </DropZone.FileInfo>
                        <Chip size="sm" variant="soft" color={toneColor(chip.tone)}>
                          {chip.label}
                        </Chip>
                      </DropZone.FileItem>
                    );
                  })}
                </DropZone.FileList>
              </DropZone>
            ) : null}

            {step === 5 ? (
              <>
                <div className="flex flex-col gap-1.5 rounded-[18px] bg-surface-secondary px-5 py-[18px]">
                  <span className="text-[13px] text-muted">One-time registration fee · {type?.label}</span>
                  <span className="text-[22px] leading-[30px] font-semibold">{app.fee}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <GateChip icon={<ShieldExclamation className="size-3" />}>Awaiting sign-off</GateChip>
                    <span className="text-xs text-muted">{app.feeSchedule}</span>
                  </span>
                </div>
                <ProcessTimeline steps={data.fees} label="When you pay" />
                <p className="text-xs leading-[17px] text-muted">
                  Payment methods are shown when the fee is due. The subscription invoice comes from Injishi and is
                  separate from any invoice you give your guests.
                </p>
              </>
            ) : null}

            {step === 6 ? (
              <>
                <RadioGroup
                  aria-label="How this registration reached Injishi"
                  value={channel}
                  onChange={(v) => touch(() => setChannel(v))}
                  className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]"
                >
                  {data.channels.map((c) => (
                    <Radio key={c.id} value={c.id}>
                      <Radio.Content className="items-start">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <span className="flex flex-col">
                          <span>{c.label}</span>
                          <span className="text-[13px] text-muted">{c.desc}</span>
                        </span>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
                {channel === "agent" ? (
                  <TextField fullWidth defaultValue={app.agent.code} className="max-w-[360px] gap-1">
                    <Label htmlFor="rg-agent">Field agent code</Label>
                    <Input id="rg-agent" />
                    <Chip size="sm" variant="soft" className="mt-0.5 self-start">
                      <Check className="size-3" />
                      <Chip.Label>Code recognised · {app.agent.team}</Chip.Label>
                    </Chip>
                  </TextField>
                ) : null}
                <p className="text-xs text-muted">
                  Every registration records how it reached us. It doesn’t affect your review or your fee.
                </p>
              </>
            ) : null}

            {step === 7 ? (
              <>
                <RadioButtonGroup
                  aria-label="Who is filling this in"
                  value={who}
                  onChange={(v) => {
                    if (!v) return;
                    touch(() => {
                      setWho(String(v));
                      setSubmitted(false);
                    });
                  }}
                  className="flex flex-wrap"
                >
                  {WHO.map((w) => (
                    <RadioButtonGroup.Item
                      key={w.id}
                      value={w.id}
                      className="min-w-[240px] flex-1 items-start gap-1.5 text-left"
                    >
                      <RadioButtonGroup.Indicator>
                        <CircleCheck className="size-4" />
                      </RadioButtonGroup.Indicator>
                      <Icon name={w.icon} className="size-5" />
                      <RadioButtonGroup.ItemContent className="flex flex-col gap-0.5">
                        <span className="font-semibold">{w.label}</span>
                        <span className="text-xs leading-4 text-muted">{w.desc}</span>
                      </RadioButtonGroup.ItemContent>
                    </RadioButtonGroup.Item>
                  ))}
                </RadioButtonGroup>
                {!isAgent ? (
                  <KeyValueList
                    className="rounded-2xl bg-surface-secondary px-4 py-3"
                    items={[
                      { label: "Owner", value: `${app.owner.name} · identity verified ${app.owner.verifiedOn}` },
                      { label: "After approval", value: "Owner of Amahoro Hospitality Group" },
                      { label: "Submits and pays", value: "You" },
                    ]}
                  />
                ) : (
                  <>
                    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                      <TextField fullWidth defaultValue={app.owner.name} className="gap-1">
                        <Label htmlFor="ow-name">Owner’s full name</Label>
                        <Input id="ow-name" />
                      </TextField>
                      <TextField fullWidth defaultValue={app.owner.phone} className="gap-1">
                        <Label htmlFor="ow-phone">Owner’s mobile</Label>
                        <Input id="ow-phone" type="tel" />
                      </TextField>
                      <TextField fullWidth defaultValue={app.owner.email} className="gap-1">
                        <Label htmlFor="ow-mail">Owner’s email</Label>
                        <Input id="ow-mail" type="email" />
                      </TextField>
                    </div>
                    <Checkbox isSelected={agreed} onChange={setAgreed}>
                      <Checkbox.Content className="gap-2">
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        The owner agreed that I start this registration for them
                      </Checkbox.Content>
                    </Checkbox>
                    <ProcessTimeline steps={data.claim} label="Owner claim" />
                    <Alert>
                      <Alert.Indicator>
                        <ShieldCheck />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Field agents prepare, owners decide</Alert.Title>
                        <Alert.Description>
                          You can’t submit, pay the fee or activate the business. Everything you enter is attributed to
                          code {app.agent.code} in the audit log.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  </>
                )}
              </>
            ) : null}

            {step === 8 ? (
              <>
                <ListView aria-label="Review" variant="secondary" items={review}>
                  {(r) => (
                    <ListView.Item id={r.id} textValue={r.title}>
                      <ListView.ItemContent>
                        <div className="flex flex-col gap-0.5">
                          <ListView.Title>{r.title}</ListView.Title>
                          <ListView.Description className="whitespace-normal">{r.value}</ListView.Description>
                        </div>
                      </ListView.ItemContent>
                      <ListView.ItemAction className="flex items-center gap-2">
                        <Chip size="sm" variant="soft" color={toneColor(r.tone)}>
                          {r.chip}
                        </Chip>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${r.title}`}
                          onPress={() => setStep(r.goto)}
                        >
                          Edit
                        </Button>
                      </ListView.ItemAction>
                    </ListView.Item>
                  )}
                </ListView>
                {submitted ? (
                  <>
                    <Alert role="status">
                      <Alert.Indicator>
                        <PaperPlane />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>
                          {isAgent ? "Claim link sent to Didier Mugenzi" : "Submitted for review"}
                        </Alert.Title>
                        <Alert.Description>
                          {isAgent
                            ? `Sent to ${app.owner.phoneMasked} and ${app.owner.email} at ${app.savedAt} · valid until ${app.claimValidUntil}. The draft stays with you and Injishi staff until the owner claims it.`
                            : `${app.id} · ${app.submittedAt}. The business stays inactive until a reviewer approves it, and you’ll be notified either way.`}
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                    {!isAgent ? (
                      <LinkButton href={screenHref("Onboarding")} className="self-start">
                        Continue to onboarding
                        <ArrowRight className="size-4" />
                      </LinkButton>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      isDisabled={submitBlocked}
                      aria-describedby="submit-why"
                      onPress={() => touch(() => setSubmitted(true))}
                    >
                      <PaperPlane className="size-4" />
                      {submitLabel}
                    </Button>
                    <span id="submit-why" className="min-w-[260px] flex-1 text-xs text-muted">
                      {submitWhy}
                    </span>
                  </div>
                )}
              </>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-separator pt-4">
              <Button variant="ghost" isDisabled={step === 0} onPress={() => setStep((s) => Math.max(0, s - 1))}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onPress={() => setSaved("Draft saved · just now")}>
                  Save draft
                </Button>
                {step < data.steps.length - 1 ? (
                  <Button onPress={() => touch(() => setStep((s) => Math.min(data.steps.length - 1, s + 1)))}>
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <aside
            aria-label="Application summary"
            className="flex w-full min-w-0 flex-col gap-4 sm:max-w-[290px] sm:flex-[0_1_290px]"
          >
            <section className="flex flex-col gap-3 rounded-2xl bg-surface p-[18px] shadow-surface">
              <div className="flex items-center justify-between gap-2">
                <CardHeading>Application</CardHeading>
                <Chip size="sm" variant="soft" color={submitted ? "accent" : "default"}>
                  {appChip}
                </Chip>
              </div>
              <KeyValueList
                className="grid-cols-[minmax(84px,max-content)_minmax(0,1fr)]"
                items={[
                  { label: "Reference", value: <span className="tabular">{app.id}</span> },
                  { label: "Business", value: app.business },
                  { label: "Type", value: type?.label ?? "" },
                  { label: "Entity", value: app.entity },
                  {
                    label: "TIN gate",
                    value: (
                      <Chip size="sm" variant="soft" color={toneColor(tinTone)}>
                        {tinChip}
                      </Chip>
                    ),
                  },
                  { label: "Location", value: app.location },
                  { label: "Prepared by", value: preparedBy },
                ]}
              />
            </section>
            <section className="flex flex-col gap-2.5 rounded-2xl bg-surface-secondary p-[18px]">
              <h2 className="text-[15px] leading-[22px] font-semibold">After You Submit</h2>
              <ProcessTimeline steps={data.after} />
            </section>
            <Alert>
              <Alert.Indicator>
                <Lock />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Nothing activates on paperwork alone</Alert.Title>
                <Alert.Description>
                  A reviewer checks your TIN, licence and documents before the business can go live.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <LinkButton href={screenHref("PublicHelp")} variant="ghost" size="sm" className="self-start">
              <LifeRing className="size-4" />
              Questions? Talk to support
            </LinkButton>
          </aside>
        </div>
      </main>
    </>
  );
}
