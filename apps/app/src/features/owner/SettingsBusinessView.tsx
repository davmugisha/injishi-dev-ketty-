"use client";

import { CircleInfo, Plus, ShieldExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Toast, toast } from "@heroui/react";
import { ItemCard } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  SettingsBusinessBranch,
  SettingsBusinessDomainCheck,
  SettingsBusinessNode,
  SettingsBusinessProfile,
  SettingsBusinessUnit,
} from "@injishi/data/fixtures/owner";
import { GateChip, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { SettingsBusinessProperty } from "./SettingsBusinessProperty";
import { SettingsBusinessTree } from "./SettingsBusinessTree";
import { SettingsNav } from "./SettingsNav";

interface SettingsBusinessData {
  nodes: SettingsBusinessNode[];
  profiles: SettingsBusinessProfile[];
  units: SettingsBusinessUnit[];
  checks: SettingsBusinessDomainCheck[];
  branches: SettingsBusinessBranch[];
}

/** ItemCard's own render-prop type, so the props match whichever React types HeroUI Pro resolves. */
type PressableRender = NonNullable<Parameters<typeof ItemCard<"button">>[0]["render"]>;
const PressableCard: PressableRender = (props) => <button type="button" {...props} />; // heroui-ok: ItemCard render (documented pressable pattern)

export function SettingsBusinessView({ data, businessName }: { data: SettingsBusinessData; businessName: string }) {
  const [sel, setSel] = useState("isg");
  const selected = data.nodes.find((n) => n.id === sel);
  const profile = data.profiles.find((p) => p.id === sel);
  const detail = selected?.detail ?? null;

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={`Settings · ${businessName}`}
        title="Business Structure"
        description="How the business is organised. Tax and fiscal details belong to each legal entity, separate from property branding."
        actions={
          <>
            <Button
              variant="ghost"
              onPress={() =>
                toast.warning(
                  "Adding a legal entity is not available yet. A new entity is registered with its own TIN through Injishi support.",
                )
              }
            >
              <Plus className="size-4" />
              Legal entity
            </Button>
            <Button
              variant="secondary"
              onPress={() =>
                toast.warning(
                  "Adding a property here is not available yet: this structure is sample data, so nothing was created.",
                )
              }
            >
              <Plus className="size-4" />
              Property or branch
            </Button>
          </>
        }
      />

      <SettingsNav current="SettingsBusiness" />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-[min(300px,100%)] flex-[0_1_380px] flex-col gap-4">
          <Card aria-labelledby="tree-h" className="gap-1.5 p-3">
            <div className="flex items-center justify-between gap-2 px-1.5 py-1">
              <h2 id="tree-h" className="text-[15px] leading-[22px] font-semibold">
                Hierarchy
              </h2>
              <span className="text-xs text-muted">Tenant › entity › property › unit</span>
            </div>
            <SettingsBusinessTree nodes={data.nodes} selected={sel} onSelect={setSel} labelledBy="tree-h" />
          </Card>

          <Card variant="secondary" aria-labelledby="br-h" className="gap-2.5 px-[18px] py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="br-h" className="text-[15px] leading-[22px] font-semibold">
                Branches
              </h2>
              <span className="text-xs text-muted">Each member’s access can be limited to these</span>
            </div>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
              {data.branches.map((b) => (
                <ItemCard<"button">
                  key={b.id}
                  render={PressableCard}
                  onClick={() => setSel(b.node)}
                  aria-current={sel === b.node ? "true" : undefined}
                  className="w-full cursor-pointer items-start text-left"
                >
                  <ItemCard.Icon>
                    <span className="text-[11px] font-bold tabular">{b.code}</span>
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>{b.name}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{b.meta}</ItemCard.Description>
                  </ItemCard.Content>
                </ItemCard>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-4">
          {profile ? (
            <SettingsBusinessProperty key={profile.id} profile={profile} units={data.units} checks={data.checks} />
          ) : null}

          {!profile && detail ? (
            <Card aria-labelledby="det-h" className="gap-3.5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted">{detail.kind}</span>
                  <h2 id="det-h" className="text-lg leading-[26px] font-semibold">
                    {detail.title}
                  </h2>
                </div>
                <Chip variant="soft" color={toneColor(detail.chipTone)}>
                  {detail.chip}
                </Chip>
              </div>
              <KeyValueList
                items={detail.facts.map((f) => ({
                  label: f.label,
                  value: <span className="font-normal">{f.value}</span>,
                }))}
              />
              {detail.gate ? (
                <GateChip icon={<ShieldExclamation className="size-3" aria-hidden="true" />} className="self-start">
                  {detail.gate}
                </GateChip>
              ) : null}
              <Alert status="default">
                <Alert.Indicator>
                  <CircleInfo />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Description>{detail.note}</Alert.Description>
                </Alert.Content>
              </Alert>
              <div className="flex flex-wrap gap-2">
                {detail.links.map((l) => (
                  <LinkButton key={l.label} href={screenHref(l.board)} size="sm" variant="secondary">
                    {l.label}
                  </LinkButton>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </PageContent>
  );
}
