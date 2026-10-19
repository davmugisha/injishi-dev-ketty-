"use client";

import { Lock, OctagonXmark } from "@gravity-ui/icons";
import { Button, Card, Chip, Description, Input, Label, ListBox, Select, Table, TextField, toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  SettingsBusinessDomainCheck,
  SettingsBusinessProfile,
  SettingsBusinessUnit,
} from "@injishi/data/fixtures/owner";
import { KeyValueList, LinkButton, TextLink, toneColor } from "@injishi/ui";
import { useState } from "react";

type Domain = SettingsBusinessUnit["domain"];

/** The profile fields the form edits. */
type SettingsBusinessProfilePatch = Pick<SettingsBusinessProfile, "name" | "type" | "location" | "phone" | "email">;

const DOMAINS: { id: Domain; label: string }[] = [
  { id: "hospitality", label: "Hospitality" },
  { id: "residence", label: "Residence" },
];

/**
 * What this card cannot save yet, said plainly. The profile, the units and their domain checks are sample
 * data: the business tree they hang off waits on an /architect decision (two legal entities in one tenant),
 * and the property type and the pending domain change have no column. So nothing here is sent to the API,
 * and the screen never shows a save, a request or a schedule that did not happen.
 */
const unavailable = (what: string) =>
  toast.warning(`${what} is not available yet. This profile is sample data, so nothing was saved or scheduled.`);

const formOf = (p: SettingsBusinessProfile): SettingsBusinessProfilePatch => ({
  name: p.name,
  type: p.type,
  location: p.location,
  phone: p.phone,
  email: p.email,
});

function PickList({
  label,
  value,
  options,
  onChange,
  description,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  description?: string;
}) {
  return (
    <Select
      fullWidth
      value={value}
      onChange={(v) => (v === null ? null : onChange(String(v)))}
      className="flex flex-col gap-1"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {description ? <Description>{description}</Description> : null}
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o} id={o} textValue={o}>
              {o}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** The selected property: its editable profile, then its room types and the domain each is sold in. */
export function SettingsBusinessProperty({
  profile,
  units,
  checks,
}: {
  profile: SettingsBusinessProfile;
  units: SettingsBusinessUnit[];
  checks: SettingsBusinessDomainCheck[];
}) {
  const [form, setForm] = useState(() => formOf(profile));

  const field = (k: keyof SettingsBusinessProfilePatch) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // A unit's domain shows what the record says: its own domain, or the change already requested for it.
  const changing = units.find((u) => checks.some((c) => c.unit === u.id));
  const unitChecks = changing ? checks.filter((c) => c.unit === changing.id) : [];
  const isBlocked = (u: SettingsBusinessUnit) => !!u.requestedDomain && u.requestedDomain !== u.domain;
  const showChecks = changing ? isBlocked(changing) : false;

  const status = (u: SettingsBusinessUnit) => {
    if (isBlocked(u)) return { label: "Change blocked", tone: "danger" as const };
    return { label: "Sellable", tone: "success" as const };
  };
  const domainShown = (u: SettingsBusinessUnit): Domain => u.requestedDomain ?? u.domain;
  const pickDomain = (u: SettingsBusinessUnit, d: Domain) => {
    if (d === domainShown(u)) return;
    unavailable(`Moving ${u.name} to ${d === "residence" ? "Residence" : "Hospitality"}`);
  };

  return (
    <>
      <Card aria-labelledby="prof-h" className="gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted">Property profile · branch code {profile.branchCode}</span>
            <h2 id="prof-h" className="text-lg leading-[26px] font-semibold">
              {profile.name}
            </h2>
          </div>
          <Chip variant="soft" color={toneColor(profile.statusTone)}>
            {profile.status}
          </Chip>
        </div>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
          <TextField value={form.name} onChange={field("name")} className="flex flex-col gap-1">
            <Label>Display name</Label>
            <Input fullWidth />
          </TextField>
          <PickList label="Property type" value={form.type} options={profile.typeOptions} onChange={field("type")} />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Legal entity</span>
            <Card variant="secondary" className="flex-row items-center gap-2 px-3 py-2">
              <Lock className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="text-[13px]">{profile.entity}</span>
            </Card>
            <span className="text-xs text-muted">
              Moving a property to another entity changes who issues receipts and receives money. Ask Injishi support.
            </span>
          </div>
          <PickList
            label="Location"
            value={form.location}
            options={profile.locationOptions}
            onChange={field("location")}
            description="Province, district, sector and cell from the national list"
          />
          <TextField value={form.phone} onChange={field("phone")} type="tel" className="flex flex-col gap-1">
            <Label>Reception phone</Label>
            <Input fullWidth />
          </TextField>
          <TextField value={form.email} onChange={field("email")} type="email" className="flex flex-col gap-1">
            <Label>Reservations email</Label>
            <Input fullWidth />
          </TextField>
        </div>

        <KeyValueList
          items={profile.facts.map((f) => ({
            label: f.label,
            value: (
              <span className="font-normal">
                {f.value}
                {f.link ? (
                  <>
                    {" · "}
                    <TextLink href={screenHref(f.link.board)}>{f.link.label}</TextLink>
                  </>
                ) : null}
              </span>
            ),
          }))}
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={() => setForm(formOf(profile))}>
            Discard
          </Button>
          <Button isDisabled={!form.name.trim()} onPress={() => unavailable("Saving the property profile")}>
            Save profile
          </Button>
        </div>
      </Card>

      <Card aria-labelledby="dom-h" className="gap-3.5 p-5">
        <Card.Header>
          <Card.Title<"h2"> id="dom-h" render={(props) => <h2 {...props} />} className="text-[15px] font-semibold">
            Units and Their Domain
          </Card.Title>
          <Card.Description>
            Hospitality units are sold by the night. Residence units are leased and never count toward hotel occupancy.
          </Card.Description>
        </Card.Header>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Units and their domain">
              <Table.Header>
                <Table.Column isRowHeader>Room type</Table.Column>
                <Table.Column>Units</Table.Column>
                <Table.Column>Domain</Table.Column>
                <Table.Column>Status</Table.Column>
              </Table.Header>
              <Table.Body>
                {units.map((u) => {
                  const st = status(u);
                  return (
                    <Table.Row key={u.id} id={u.id} className={isBlocked(u) ? "[&>td]:bg-default" : undefined}>
                      <Table.Cell>
                        <span className="flex flex-col">
                          <span className="font-medium">{u.name}</span>
                          <span className="text-xs text-muted">{u.rate}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-[13px] tabular">{u.rooms}</Table.Cell>
                      <Table.Cell>
                        <Segment
                          aria-label={`Domain for ${u.name}`}
                          selectedKey={domainShown(u)}
                          onSelectionChange={(k) => pickDomain(u, String(k) as Domain)}
                        >
                          {DOMAINS.map((d) => (
                            <Segment.Item key={d.id} id={d.id}>
                              {d.label}
                            </Segment.Item>
                          ))}
                        </Segment>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={toneColor(st.tone)}>
                          {st.label}
                        </Chip>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>

        {changing && showChecks ? (
          <Card variant="secondary" role="alert" aria-labelledby="val-h" className="gap-3 p-4">
            <div className="flex items-start gap-2.5">
              <OctagonXmark className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <h3 id="val-h" className="text-sm font-semibold">
                  Lake Apartments 405–406 can’t switch to Residence today
                </h3>
                <p className="text-[13px] leading-[18px] text-muted">
                  Changing a unit’s domain moves it out of nightly selling. These checks must pass first.
                </p>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {unitChecks.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <Chip size="sm" variant="soft" color={toneColor(c.tone)} className="shrink-0">
                    {c.tag}
                  </Chip>
                  <span className="text-[13px] leading-[19px]">{c.text}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onPress={() => unavailable("Scheduling the domain change")}>
                Schedule from 3 Dec 2026
              </Button>
              <LinkButton href={screenHref("Reservations")} size="sm" variant="secondary">
                Open the 3 bookings
              </LinkButton>
              <Button size="sm" variant="ghost" onPress={() => unavailable("Withdrawing the domain change")}>
                Keep as hospitality
              </Button>
            </div>
          </Card>
        ) : null}
      </Card>
    </>
  );
}
