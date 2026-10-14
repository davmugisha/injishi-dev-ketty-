"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  ArrowUpRightFromSquare,
  CircleCheckFill,
  CircleXmarkFill,
  Clock,
  Lock,
  PaperPlane,
  StarFill,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  ProgressBar,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { DropZone, RadioButtonGroup, Timeline } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  ListingAmenity,
  ListingBookingMode,
  ListingCheck,
  ListingDraft,
  ListingHistoryEntry,
  ListingModeOption,
  ListingPhoto,
  ListingPolicy,
} from "@injishi/data/fixtures/commercial";
import { stock } from "@injishi/data/media";
import {
  formatNumber,
  formatRwf,
  Icon,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  Photo,
  toneColor,
} from "@injishi/ui";
import { type ReactNode, useState } from "react";

export interface ListingData {
  draft: ListingDraft;
  photos: ListingPhoto[];
  modes: ListingModeOption[];
  amenities: ListingAmenity[];
  policies: ListingPolicy[];
  checks: ListingCheck[];
  history: ListingHistoryEntry[];
}

const photoOf = (photo: ListingPhoto) => stock[photo.image as keyof typeof stock];

/** Single-choice select used by the listing form (label, trigger, optional helper text, options). */
function ListingSelect({
  label,
  value,
  options,
  onChange,
  description,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  description?: string;
}) {
  return (
    <Select
      fullWidth
      variant="secondary"
      value={value}
      onChange={(key) => {
        if (key != null && !Array.isArray(key)) onChange(String(key));
      }}
      className="gap-[4px]"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {description ? <Description>{description}</Description> : null}
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option} id={option} textValue={option}>
              {option}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Card heading of the board: 15px semibold title with an optional description line. */
function ListingCardHeader({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card.Header className="flex flex-row items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-[2px]">
        <Card.Title<"h2">
          render={(props) => <h2 {...props} />}
          id={id}
          className="text-[15px] leading-[22px] font-semibold"
        >
          {title}
        </Card.Title>
        {description ? <Card.Description>{description}</Card.Description> : null}
      </div>
      {action}
    </Card.Header>
  );
}

export function ListingView({ persona, data }: { persona: Persona; data: ListingData }) {
  const { draft, modes, amenities, policies, checks } = data;

  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [propertyType, setPropertyType] = useState(draft.propertyType);
  const [location, setLocation] = useState(draft.location);
  const [order, setOrder] = useState(() => data.photos.filter((p) => p.listed).map((p) => p.id));
  const [mode, setMode] = useState<ListingBookingMode>(draft.mode);
  const [replyWithin, setReplyWithin] = useState(draft.replyWithin);
  const [requestHold, setRequestHold] = useState(draft.requestHold);
  const [shown, setShown] = useState(() => amenities.filter((a) => a.shown).map((a) => a.id));
  const [published, setPublished] = useState(false);

  const byId = new Map(data.photos.map((p) => [p.id, p]));
  const photos = order.flatMap((id) => byId.get(id) ?? []);
  const nextUpload = data.photos.find((p) => !p.listed && !order.includes(p.id));
  const photoCount = photos.length;
  const photosOk = photoCount >= draft.minPhotos;
  const missing = Math.max(draft.minPhotos - photoCount, 0);

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j] as string, next[i] as string];
    setOrder(next);
  };
  const addPhoto = () => {
    if (nextUpload) setOrder((o) => [...o, nextUpload.id]);
  };

  const gate = checks.map((c) => {
    if (c.rule !== "photos") return c;
    return {
      ...c,
      passed: photosOk,
      evidence: photosOk ? `${photoCount} photos · cover set` : `${photoCount} uploaded · add ${missing} more`,
    };
  });
  const gateMet = gate.filter((g) => g.passed).length;
  const blocked = gate.some((g) => !g.passed);

  const chosen = amenities.filter((a) => shown.includes(a.id)).map((a) => a.label);
  const amenLine = chosen.slice(0, 4).join(" · ") + (chosen.length > 4 ? ` · +${chosen.length - 4} more` : "");
  const currentMode = modes.find((m) => m.id === mode);
  const cover = photos[0];

  const history: ListingHistoryEntry[] = published
    ? [
        {
          id: "submitted",
          title: `${draft.submittedAt} · v${draft.draftVersion} submitted for review`,
          detail: `${persona.name} · ${photoCount} photos · ${currentMode?.label ?? ""}`,
          status: "current",
          icon: "Clock",
        },
        ...data.history,
      ]
    : data.history;

  return (
    <PageContent>
      <PageHeader
        eyebrow={<>{draft.property} · Marketplace and direct booking page</>}
        title="Listing"
        description="What guests see before they book. Edits stay as a draft until every publish check passes."
        actions={
          <>
            <Chip color="warning" variant="soft">
              {published ? `v${draft.draftVersion} in review` : "Unpublished changes"}
            </Chip>
            <LinkButton href={screenHref("MarketProperty")} variant="secondary">
              <ArrowUpRightFromSquare className="size-4" aria-hidden="true" />
              View live page
            </LinkButton>
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-[16px]">
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-[16px]">
          <Card<"section">
            render={(props) => <section {...props} />}
            aria-labelledby="basics-h"
            className="gap-[14px] p-[18px]"
          >
            <ListingCardHeader id="basics-h" title="Basics" />
            <TextField
              fullWidth
              variant="secondary"
              value={title}
              onChange={setTitle}
              maxLength={draft.titleMaxLength}
              className="gap-[4px]"
            >
              <Label>Title</Label>
              <Input />
              <Description className="tabular">
                {title.length} of {draft.titleMaxLength} characters
              </Description>
            </TextField>
            <TextField
              fullWidth
              variant="secondary"
              value={description}
              onChange={setDescription}
              className="gap-[4px]"
            >
              <Label>Description</Label>
              <TextArea rows={3} />
            </TextField>
            <div className="grid gap-[12px] [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
              <ListingSelect
                label="Property type"
                value={propertyType}
                options={draft.propertyTypes}
                onChange={setPropertyType}
              />
              <TextField fullWidth variant="secondary" value={location} onChange={setLocation} className="gap-[4px]">
                <Label>Location shown</Label>
                <Input />
              </TextField>
            </div>
          </Card>

          <Card<"section">
            render={(props) => <section {...props} />}
            aria-labelledby="photos-h"
            className="gap-[12px] p-[18px]"
          >
            <ListingCardHeader
              id="photos-h"
              title="Photos"
              description={
                <span className="tabular">
                  {photoCount} of at least {draft.minPhotos} · the first photo is the cover
                </span>
              }
              action={
                <Chip size="sm" variant="soft" color={photosOk ? "success" : "danger"} className="shrink-0">
                  {photosOk ? "Enough photos" : `Needs ${missing} more`}
                </Chip>
              }
            />
            <div className="grid gap-[10px] [grid-template-columns:repeat(auto-fill,minmax(min(160px,100%),1fr))]">
              {photos.map((p, i) => (
                <figure key={p.id} className="m-0 flex flex-col gap-[6px]">
                  <div className="relative h-[84px] overflow-hidden rounded-xl bg-surface-secondary">
                    <Photo image={photoOf(p)} fill sizes="(min-width: 1024px) 200px, 50vw" />
                    <Chip size="sm" className="absolute top-[6px] left-[6px]">
                      <Chip.Label className="tabular">{i === 0 ? "1 · Cover" : String(i + 1)}</Chip.Label>
                    </Chip>
                  </div>
                  <figcaption className="flex items-start gap-[4px]">
                    <span className="flex-1 text-[12px] leading-[16px]">{p.caption}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label={`Move ${p.caption} earlier`}
                      onPress={() => move(i, -1)}
                      isDisabled={i === 0}
                    >
                      <ArrowLeft className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label={`Move ${p.caption} later`}
                      onPress={() => move(i, 1)}
                      isDisabled={i === photos.length - 1}
                    >
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </figcaption>
                </figure>
              ))}
              {nextUpload ? (
                <DropZone className="flex">
                  <DropZone.Area
                    onDrop={addPhoto}
                    className="relative h-[84px] w-full gap-[4px] p-[8px] hover:bg-surface-secondary"
                  >
                    <DropZone.Icon className="[&_svg]:size-4">
                      <ArrowUpFromLine aria-hidden="true" />
                    </DropZone.Icon>
                    <DropZone.Label className="text-[12px] leading-[16px]">Add photos</DropZone.Label>
                    <DropZone.Description className="text-[11px] leading-[14px]">
                      JPG or PNG, 1600 px+
                    </DropZone.Description>
                    <DropZone.Trigger
                      aria-label="Add photos"
                      onPress={addPhoto}
                      className="absolute inset-0 m-0 h-full rounded-[inherit] border-0 bg-transparent p-0 md:h-full"
                    >
                      {""}
                    </DropZone.Trigger>
                  </DropZone.Area>
                </DropZone>
              ) : null}
            </div>
          </Card>

          <Card<"section">
            render={(props) => <section {...props} />}
            aria-labelledby="mode-h"
            className="gap-[12px] p-[18px]"
          >
            <ListingCardHeader
              id="mode-h"
              title="Booking Mode"
              description="Applies to marketplace and direct booking page. Front desk bookings are unaffected."
            />
            <RadioButtonGroup
              aria-labelledby="mode-h"
              layout="grid"
              value={mode}
              onChange={(v) => setMode(v as ListingBookingMode)}
              className="[grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]"
            >
              {modes.map((m) => (
                <RadioButtonGroup.Item key={m.id} value={m.id}>
                  <RadioButtonGroup.Indicator>
                    <CircleCheckFill />
                  </RadioButtonGroup.Indicator>
                  <RadioButtonGroup.ItemContent className="gap-[4px] pr-[24px]">
                    <Label className="flex items-center gap-[8px] font-semibold">
                      <Icon name={m.icon} className="size-4" />
                      {m.label}
                    </Label>
                    <Description className="text-[13px] leading-[18px]">{m.desc}</Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              ))}
            </RadioButtonGroup>
            {mode === "request" ? (
              <div className="grid gap-[12px] [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                <ListingSelect
                  label="Reply within"
                  value={replyWithin}
                  options={draft.replyWithinOptions}
                  onChange={setReplyWithin}
                  description="No reply means an automatic decline"
                />
                <ListingSelect
                  label="Rooms during the request"
                  value={requestHold}
                  options={draft.requestHoldOptions}
                  onChange={setRequestHold}
                  description="Released the moment a request expires"
                />
              </div>
            ) : null}
          </Card>

          <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr))]">
            <Card<"section">
              render={(props) => <section {...props} />}
              aria-labelledby="am-h"
              className="gap-[12px] p-[18px]"
            >
              <ListingCardHeader
                id="am-h"
                title="Amenities Shown"
                description={`${chosen.length} selected · from Rates & inventory`}
              />
              <CheckboxGroup
                aria-labelledby="am-h"
                value={shown}
                onChange={setShown}
                className="grid grid-cols-2 gap-x-[12px] gap-y-[8px]"
              >
                {amenities.map((a) => (
                  <Checkbox key={a.id} value={a.id} variant="secondary" className="mt-0">
                    <Checkbox.Content className="gap-[8px] text-[13px]">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      {a.label}
                    </Checkbox.Content>
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </Card>

            <Card<"section">
              render={(props) => <section {...props} />}
              aria-labelledby="pol-h"
              className="gap-[12px] p-[18px]"
            >
              <ListingCardHeader
                id="pol-h"
                title="Policies Summary"
                description="Shown at checkout with their version"
                action={
                  <LinkButton
                    href={screenHref("SettingsPolicies")}
                    size="sm"
                    variant="ghost"
                    aria-label="Edit policies"
                    className="shrink-0"
                  >
                    Edit
                  </LinkButton>
                }
              />
              <KeyValueList items={policies.map((p) => ({ label: p.label, value: p.value }))} />
            </Card>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[16px]">
          <Card<"section">
            render={(props) => <section {...props} />}
            aria-labelledby="gate-h"
            className="gap-[12px] p-[18px]"
          >
            <ListingCardHeader
              id="gate-h"
              title="Publish Checks"
              description="All five must pass before changes go live"
            />
            <ProgressBar
              value={gateMet}
              maxValue={gate.length}
              valueLabel={`${gateMet} of ${gate.length}`}
              aria-label="Publish checks passed"
              className="gap-[6px]"
            >
              <Label>Checks passed</Label>
              <ProgressBar.Output className="tabular" />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
              {gate.map((g) => (
                <li key={g.id} className="flex items-start gap-[10px]">
                  {g.passed ? (
                    <CircleCheckFill role="img" aria-label="Passed" className="mt-[2px] size-4 shrink-0 text-success" />
                  ) : (
                    <CircleXmarkFill role="img" aria-label="Not met" className="mt-[2px] size-4 shrink-0 text-danger" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span className="text-[13px] leading-[18px] font-medium">{g.title}</span>
                    <span className="text-[12px] leading-[16px] text-muted">{g.evidence}</span>
                  </span>
                </li>
              ))}
            </ul>
            {blocked ? (
              <>
                <Alert status="warning">
                  <Alert.Indicator>
                    <Lock />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Publishing is blocked</Alert.Title>
                    <Alert.Description>
                      {`Add ${missing} more ${missing === 1 ? "photo" : "photos"} to publish. `}
                      {`The live listing (v${draft.liveVersion}) stays online unchanged.`}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <Button fullWidth isDisabled aria-describedby="gate-h">
                  Publish changes
                </Button>
              </>
            ) : null}
            {!blocked && !published ? (
              <Button fullWidth onPress={() => setPublished(true)}>
                <PaperPlane className="size-4" aria-hidden="true" />
                Publish changes
              </Button>
            ) : null}
            {!blocked && published ? (
              <Alert status="accent" role="status">
                <Alert.Indicator>
                  <Clock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>v{draft.draftVersion} submitted · content review pending</Alert.Title>
                  <Alert.Description>
                    {"Injishi reviews new photos and text, usually within 24 hours. "}
                    {`v${draft.liveVersion} stays live until v${draft.draftVersion} is approved.`}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </Card>

          <Card<"section">
            render={(props) => <section {...props} />}
            aria-labelledby="prev-h"
            className="gap-[12px] p-[18px]"
          >
            <ListingCardHeader
              id="prev-h"
              title="Preview"
              description="Search result card on the marketplace, with your unsaved changes"
            />
            <Card<"article">
              variant="secondary"
              render={(props) => <article {...props} />}
              aria-label="Marketplace card preview"
              className="gap-[10px] p-[10px]"
            >
              <div className="relative h-[150px] overflow-hidden rounded-xl bg-surface-tertiary">
                {cover ? <Photo image={photoOf(cover)} fill sizes="(min-width: 1024px) 420px, 100vw" /> : null}
                {cover ? (
                  <Chip size="sm" className="absolute bottom-[8px] left-[10px]">
                    <Chip.Label>{cover.caption}</Chip.Label>
                  </Chip>
                ) : null}
              </div>
              <div className="flex flex-col gap-[4px] px-[4px] pb-[4px]">
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="font-semibold">{draft.property}</span>
                  <span className="flex shrink-0 items-center gap-[4px] text-[13px]">
                    <StarFill className="size-[14px] text-warning" aria-hidden="true" />
                    <span className="tabular">
                      {formatNumber(draft.rating)} · {draft.reviews} reviews
                    </span>
                  </span>
                </div>
                <span className="text-[13px] text-muted">{location}</span>
                <span className="mt-[4px] flex flex-wrap gap-[6px]">
                  <Chip size="sm" variant="soft" color={toneColor(currentMode?.chipTone)}>
                    {currentMode?.label}
                  </Chip>
                  <Chip size="sm" variant="soft">
                    {draft.cancellationChip}
                  </Chip>
                </span>
                <span className="mt-[2px] text-[12px] text-muted">{amenLine}</span>
                <span className="mt-[6px]">
                  <span className="text-[16px] font-[650] tabular">{formatRwf(draft.fromRate)}</span>{" "}
                  <span className="text-[13px] text-muted">per night · from {draft.fromRoomType}</span>
                </span>
              </div>
            </Card>
          </Card>

          <Card<"section">
            render={(props) => <section {...props} />}
            aria-labelledby="hist-h"
            className="gap-[12px] p-[18px]"
          >
            <ListingCardHeader
              id="hist-h"
              title="Publish and Rate History"
              description="Who changed what, when and why"
            />
            <Timeline size="sm" density="compact">
              {history.map((h) => (
                <Timeline.Item key={h.id} status={h.status}>
                  <Timeline.Rail>
                    <Timeline.Marker>
                      <Icon name={h.icon} className="size-3" />
                    </Timeline.Marker>
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-[2px]">
                    <span className="text-[13px] leading-[18px] font-medium">{h.title}</span>
                    <span className="text-[12px] leading-[16px] text-muted">{h.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </div>
      </div>
    </PageContent>
  );
}
