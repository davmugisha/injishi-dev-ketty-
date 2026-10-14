"use client";

import {
  ArrowRight,
  ArrowRightToSquare,
  Bell,
  CircleInfo,
  EnvelopeOpen,
  FileText,
  GraduationCap,
  Key,
  LifeRing,
  ListCheck,
  Lock,
  Magnifier,
  Person,
  ShieldExclamation,
  ShieldKeyhole,
} from "@gravity-ui/icons";
import { Avatar, Card, Chip } from "@heroui/react";
import { KPIGroup, Navbar, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { type BoardId, screenHref } from "@injishi/data";
import type { HubGroup, HubRole } from "@injishi/data/fixtures/platform";
import { GateChip, Icon, LinkButton, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { Fragment, useState } from "react";
import { BrandMark } from "@/components/brand";

const FILTERS = [
  { id: "all", label: "All roles" },
  { id: "operator", label: "Operator web" },
  { id: "devices", label: "Staff devices" },
  { id: "guests", label: "Guests and public" },
  { id: "external", label: "Institutions and Injishi" },
];

const SHARED: { board: BoardId; label: string; icon: typeof Key }[] = [
  { board: "SignIn", label: "Sign in", icon: Key },
  { board: "InviteAccept", label: "Accept invitation", icon: EnvelopeOpen },
  { board: "Register", label: "Business registration", icon: FileText },
  { board: "Onboarding", label: "Onboarding", icon: ListCheck },
  { board: "Account", label: "Account and privacy", icon: Person },
  { board: "GlobalSearch", label: "Global search", icon: Magnifier },
  { board: "Notifications", label: "Notifications", icon: Bell },
  { board: "StatesGallery", label: "High-stakes states", icon: CircleInfo },
  { board: "AccessDenied", label: "Access denied and step-up", icon: ShieldKeyhole },
  { board: "PublicHelp", label: "Help centre", icon: LifeRing },
  { board: "Training", label: "Training", icon: GraduationCap },
];

export interface HubData {
  groups: HubGroup[];
  roles: HubRole[];
  /** Board → link target for the signed-in visitor (direct, or sign-in with the persona pre-selected). */
  hrefs: Partial<Record<BoardId, string>>;
  screenCount: number;
  signedInAs: { name: string; home: string } | null;
}

/** Prototype hub (artifact: Main.dc.html) — every role, grouped by surface, each opening its workspace. */
export function HubView({ data }: { data: HubData }) {
  const [filter, setFilter] = useState("all");
  const link = (board: BoardId) => data.hrefs[board] ?? screenHref(board);
  const groups = data.groups.filter((g) => filter === "all" || g.id === filter);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Navbar position="static" className="bg-background">
        <Navbar.Header className="mx-auto w-full max-w-[1240px] gap-4 px-4 py-4 sm:px-8">
          <NextLink href="/" className="flex items-center gap-2.5 text-foreground no-underline">
            <BrandMark size={32} />
            <span className="text-[17px] font-semibold tracking-[-0.01em]">Injishi</span>
          </NextLink>
          <Chip variant="soft" className="hidden sm:inline-flex">
            Role prototype · v1 scope
          </Chip>
          <Navbar.Spacer />
          {data.signedInAs ? (
            <LinkButton href={data.signedInAs.home} variant="ghost" size="sm">
              <Person className="size-4" />
              {data.signedInAs.name}
            </LinkButton>
          ) : (
            <LinkButton href={screenHref("SignIn")} variant="ghost" size="sm">
              <ArrowRightToSquare className="size-4" />
              Sign in
            </LinkButton>
          )}
          <LinkButton href={screenHref("Register")} size="sm">
            Register a business
          </LinkButton>
        </Navbar.Header>
      </Navbar>

      <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pt-6 pb-[72px] sm:px-8">
        <section className="flex flex-wrap items-end gap-6">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-2.5">
            <p className="text-[13px] leading-[18px] font-medium text-muted">Hospitality platform for Rwanda</p>
            <h1 className="max-w-[760px] text-[40px] leading-[46px] font-semibold tracking-[-0.025em]">
              One platform. A workspace shaped for every person who runs the business.
            </h1>
            <p className="max-w-[680px] text-base text-muted">
              Each role lands on its own work, sees only what its permissions allow, and never mistakes a pending
              payment, receipt or approval for a confirmed one. Pick a role to open its workspace.
            </p>
          </div>
          <KPIGroup className="min-w-0 flex-[0_1_520px]">
            {[
              { label: "Screens", value: data.screenCount },
              { label: "Roles", value: 22 },
              { label: "Surfaces", value: 7 },
            ].map((k, i) => (
              <Fragment key={k.label}>
                {i > 0 ? <KPIGroup.Separator /> : null}
                <KPI>
                  <KPI.Title>{k.label}</KPI.Title>
                  <KPI.Value value={k.value} className="tabular" />
                </KPI>
              </Fragment>
            ))}
          </KPIGroup>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <Segment
            aria-label="Filter roles by surface"
            selectedKey={filter}
            onSelectionChange={(k) => setFilter(String(k))}
          >
            {FILTERS.map((f) => (
              <Segment.Item key={f.id} id={f.id}>
                {f.label}
              </Segment.Item>
            ))}
          </Segment>
          <span className="flex-1" />
          <Chip color="warning" variant="soft">
            Proposed role
          </Chip>
          <GateChip icon={<ShieldExclamation className="size-3" />}>Needs verification</GateChip>
          <GateChip icon={<Lock className="size-3" />}>External gate</GateChip>
        </section>

        {groups.map((g) => (
          <section key={g.id} className="flex flex-col gap-3.5" aria-labelledby={`g-${g.id}`}>
            <div className="flex flex-col gap-0.5">
              <h2 id={`g-${g.id}`} className="text-lg leading-[26px] font-semibold">
                {g.title}
              </h2>
              <p className="text-sm text-muted">{g.desc}</p>
            </div>
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(272px,100%),1fr))]">
              {data.roles
                .filter((r) => r.group === g.id)
                .map((r) => (
                  <Card key={r.id} className="gap-3.5 p-[18px]">
                    <div className="flex items-center gap-3">
                      <Avatar variant="soft" color={toneColor(r.avatarTone)} className="size-10">
                        <Avatar.Fallback>{r.initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <h3 className="text-[15px] leading-5 font-semibold">{r.name}</h3>
                        <span className="truncate text-xs leading-4 text-muted">{r.persona}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip variant="soft" color={toneColor(r.statusTone)}>
                        {r.status}
                      </Chip>
                      <Chip variant="soft">
                        <Icon name={r.deviceIcon} className="size-3" />
                        <Chip.Label>{r.device}</Chip.Label>
                      </Chip>
                    </div>
                    <p className="flex-1 text-[13px] leading-[19px] text-muted">{r.lands}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <LinkButton href={link(r.board)} size="sm" aria-label={`Open ${r.name}`}>
                        Open
                        <ArrowRight className="size-4" />
                      </LinkButton>
                      {r.links.map((l) => (
                        <LinkButton key={l.board} href={link(l.board)} size="sm" variant="tertiary">
                          {l.label}
                        </LinkButton>
                      ))}
                    </div>
                  </Card>
                ))}
            </div>
          </section>
        ))}

        <Card variant="secondary" className="gap-3 p-5">
          <h2 className="text-[15px] leading-[22px] font-semibold">Shared Across Roles</h2>
          <div className="flex flex-wrap gap-2">
            {SHARED.map((s) => (
              <LinkButton key={s.board} href={link(s.board)} size="sm" variant="secondary">
                <s.icon className="size-4" />
                {s.label}
              </LinkButton>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
