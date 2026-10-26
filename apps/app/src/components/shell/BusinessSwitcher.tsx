"use client";

import { ChevronRight, ChevronsExpandVertical, Magnifier } from "@gravity-ui/icons";
import { Avatar, Button, Chip, Popover, Radio, RadioGroup, SearchField } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { canAccess, type Persona, screenHref, type WorkspaceContext } from "@injishi/data";
import { LinkButton, TextLink } from "@injishi/ui";
import NextLink from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { switchBusiness } from "@/lib/workspace-actions";
import { useWorkspaceStore } from "@/lib/workspace-store";

function Tile({
  ini,
  variant = "solid",
  size = "md",
}: {
  ini: string;
  variant?: "solid" | "outline" | "pending" | "round";
  size?: "sm" | "md";
}) {
  const base = size === "sm" ? "size-8 rounded-lg text-xs" : "size-10 rounded-xl text-sm";
  const look = {
    solid: "bg-accent-soft text-accent-soft-foreground",
    outline: "text-foreground ring-[1.5px] ring-border-secondary ring-inset",
    pending: "text-muted outline-[1.5px] outline-dashed outline-border-tertiary -outline-offset-[1.5px]",
    round: "rounded-full bg-surface-tertiary text-foreground",
  }[variant];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-semibold ${base} ${look}`}
    >
      {ini}
    </span>
  );
}

function Row({ children, href, className }: { children: ReactNode; href?: string; className?: string }) {
  const cls = `flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left text-sm no-underline text-foreground ${href ? "hover:bg-default" : ""} ${className ?? ""}`;
  return href ? (
    <NextLink href={href} className={cls}>
      {children}
    </NextLink>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/** A row that opens another real business: the session switches to it first, then its home opens. */
function SwitchRow({ workspaceId, href, children }: { workspaceId: string; href: string; children: ReactNode }) {
  return (
    <form action={switchBusiness}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="next" value={href} />
      <button
        type="submit"
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-default"
      >
        {children}
      </button>
    </form>
  );
}

function SectionLabel({ id, children, extra }: { id: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 pt-0.5 pb-1.5 text-xs leading-4 font-medium text-muted">
      <span id={id}>{children}</span>
      {extra}
    </div>
  );
}

/** The switcher panel body (artifact: BusinessSwitcher.dc.html). */
function SwitcherPanel({
  persona,
  ctx,
  branch,
  onBranch,
  onNavigate,
}: {
  persona: Persona;
  ctx: WorkspaceContext;
  branch: string;
  onBranch: (id: string) => void;
  onNavigate?: () => void;
}) {
  const [q, setQ] = useState("");
  const accepted = useWorkspaceStore((s) => !!s.acceptedInvites[persona.id]);
  const acceptInvite = useWorkspaceStore((s) => s.acceptInvite);
  const query = q.trim().toLowerCase();
  const hit = (s: string) => !query || s.toLowerCase().includes(query);
  const branches = ctx.branches.filter((b) => hit(b.name) || hit(ctx.name));
  const others = ctx.others.filter((o) => hit(o.name));
  const showInvite = !!ctx.invite && hit(ctx.invite.name);
  const showPersonal = canAccess(persona.id, "GuestAccount") && (hit(persona.name) || hit("personal trips stays"));
  const showCurrent = branches.length > 0;
  const showOthers = !query || others.length > 0 || showInvite;
  const noOthers = !query && ctx.others.length === 0 && !ctx.invite;
  const noMatch = !!query && !showCurrent && !showOthers && !showPersonal;

  return (
    <div
      className="flex max-h-[min(740px,calc(100dvh-96px))] w-[400px] max-w-[calc(100vw-24px)] flex-col overflow-hidden"
      role="group"
      aria-label="Switch business or branch"
    >
      <div className="flex flex-col gap-1 px-[18px] pt-[18px] pb-3">
        <h2 className="text-base leading-[22px] font-semibold tracking-[-0.01em]">Switch Business or Branch</h2>
        <p className="text-sm text-muted">Your role changes with the business. {ctx.rolePhrase}</p>
      </div>
      <div className="px-4 pt-1 pb-3.5">
        <SearchField aria-label="Find a business or branch" value={q} onChange={setQ} fullWidth>
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Magnifier />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Find a business or branch" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showCurrent ? (
          <section className="border-t border-separator px-2 py-2.5" aria-labelledby="bs-current">
            <SectionLabel
              id="bs-current"
              extra={
                <span className="inline-flex gap-1.5">
                  {ctx.proposedRole ? (
                    <Chip size="sm" color="warning" variant="soft">
                      Proposed role
                    </Chip>
                  ) : null}
                  <Chip size="sm" color="accent" variant="soft">
                    {ctx.role}
                  </Chip>
                </span>
              }
            >
              Current Business
            </SectionLabel>
            <Row>
              <Tile ini={ctx.ini} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{ctx.name}</span>
                <span className="truncate text-xs text-muted">{ctx.meta}</span>
              </span>
            </Row>
            <RadioGroup aria-label="Branch" value={branch} onChange={(v) => onBranch(v)} className="gap-0.5">
              {branches.map((b) => (
                <Radio
                  key={b.id}
                  value={b.id}
                  className="rounded-xl px-2.5 py-1 pl-4 data-[selected=true]:bg-surface-secondary"
                >
                  <Radio.Content className="flex min-h-9 w-full items-center gap-3">
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    <span className={`truncate ${b.id === branch ? "font-semibold" : ""}`}>{b.name}</span>
                    <span className="ml-auto inline-flex items-center gap-1.5 pl-2 text-xs whitespace-nowrap text-muted tabular-nums">
                      {b.meta}
                      {b.id === branch ? " · current" : ""}
                      {b.warn ? (
                        <>
                          {" · "}
                          <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
                          {b.warn}
                        </>
                      ) : null}
                    </span>
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>
            {ctx.canManage && !query ? (
              <TextLink
                href={screenHref("SettingsBusiness")}
                className="mt-1 mb-0.5 ml-4 inline-flex px-2.5 py-1 text-sm font-medium"
              >
                Manage branches
              </TextLink>
            ) : null}
          </section>
        ) : null}

        {showOthers ? (
          <section className="border-t border-separator px-2 py-2.5" aria-labelledby="bs-others">
            <SectionLabel id="bs-others">Your Other Businesses</SectionLabel>
            {others.map((o) => {
              const body = (
                <>
                  <Tile ini={o.ini} variant="outline" />
                  <span className="flex min-w-0 flex-1 flex-col" onClickCapture={onNavigate}>
                    <span className="truncate font-semibold">{o.name}</span>
                    <span className="truncate text-xs text-muted">{o.meta}</span>
                  </span>
                  {o.count ? (
                    <Chip size="sm" color="warning" variant="soft" aria-label={o.countLabel}>
                      {o.count}
                    </Chip>
                  ) : null}
                  <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                </>
              );
              return o.workspaceId ? (
                <SwitchRow key={o.workspaceId} workspaceId={o.workspaceId} href={screenHref(o.board)}>
                  {body}
                </SwitchRow>
              ) : (
                <Row key={o.name} href={screenHref(o.board)}>
                  {body}
                </Row>
              );
            })}
            {showInvite && ctx.invite ? (
              accepted ? (
                <Row href={screenHref(ctx.invite.board)}>
                  <Tile ini={ctx.invite.ini} variant="outline" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{ctx.invite.name}</span>
                    <span className="truncate text-xs text-muted">{ctx.invite.role} · joined just now</span>
                  </span>
                  <Chip size="sm" color="success" variant="soft">
                    Joined
                  </Chip>
                  <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                </Row>
              ) : (
                <Row>
                  <Tile ini={ctx.invite.ini} variant="pending" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{ctx.invite.name}</span>
                    <span className="truncate text-xs text-muted">{ctx.invite.role} · invitation waiting</span>
                  </span>
                  <Button size="sm" variant="outline" onPress={() => acceptInvite(persona.id)}>
                    Accept
                  </Button>
                </Row>
              )
            ) : null}
            {noOthers ? (
              <p className="px-2.5 pt-1 pb-1.5 text-sm text-muted">
                No other businesses yet. An owner can invite you, or you can register your own.
              </p>
            ) : null}
          </section>
        ) : null}

        {showPersonal ? (
          <section className="border-t border-separator px-2 py-2.5" aria-labelledby="bs-personal">
            <SectionLabel id="bs-personal">Personal</SectionLabel>
            <Row href={screenHref("GuestAccount")}>
              <Tile ini={persona.initials} variant="round" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{persona.name}</span>
                <span className="truncate text-xs text-muted">Your own trips and stays</span>
              </span>
              <ChevronRight className="size-4 text-muted" aria-hidden="true" />
            </Row>
          </section>
        ) : null}

        {noMatch ? (
          <EmptyState className="border-t border-separator py-6">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Magnifier />
              </EmptyState.Media>
              <EmptyState.Title>No business or branch matches “{q}”</EmptyState.Title>
              <EmptyState.Description>
                Check the spelling, or join a business with an invite code.
              </EmptyState.Description>
            </EmptyState.Header>
          </EmptyState>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-separator bg-surface-secondary px-4 py-3">
        <LinkButton href={screenHref("Register")} size="sm" variant="outline">
          Add a business
        </LinkButton>
        <TextLink href={screenHref("InviteAccept")} className="text-sm font-medium">
          Join with an invite code
        </TextLink>
      </div>
    </div>
  );
}

/** Sidebar switcher: business + branch for business personas, a fixed header for institutions. */
export function BusinessSwitcher({
  persona,
  defaultOpen = false,
  inline = false,
}: {
  persona: Persona;
  defaultOpen?: boolean;
  /** Render the panel in the page flow under the trigger (the standalone /switcher screen). */
  inline?: boolean;
}) {
  const ctx = persona.workspace;
  const storedBranch = useWorkspaceStore((s) => s.branchByPersona[persona.id]);
  const setBranch = useWorkspaceStore((s) => s.setBranch);
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    void useWorkspaceStore.persist.rehydrate();
  }, []);
  const branch = storedBranch ?? ctx?.currentBranch ?? "";
  const current = useMemo(() => ctx?.branches.find((b) => b.id === branch) ?? ctx?.branches[0], [ctx, branch]);

  if (!ctx) return null;
  if (ctx.kind === "institution") {
    return (
      <div className="flex w-full items-center gap-2.5 rounded-xl bg-surface px-2.5 py-2 shadow-surface">
        <Avatar size="sm" variant="soft" color={ctx.tone === "danger" ? "danger" : "accent"}>
          <Avatar.Fallback>{ctx.ini}</Avatar.Fallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col" data-sidebar="label">
          <span className="truncate text-sm font-semibold">{ctx.name}</span>
          <span className="truncate text-xs leading-4 text-muted">{ctx.sub}</span>
        </span>
      </div>
    );
  }

  const isAll = current?.id === "all";
  const title = isAll ? ctx.name : (current?.name ?? ctx.name);
  // A business with one branch of its own name says the role alone, not the name twice.
  const sub = !isAll && title === ctx.name ? ctx.role : `${isAll ? "All branches" : ctx.name} · ${ctx.role}`;
  const trigger = (props: { onPress?: () => void; expanded?: boolean }) => (
    <Button
      variant="secondary"
      className="h-auto w-full justify-start gap-2.5 rounded-xl bg-surface px-2.5 py-2 text-left shadow-surface in-[.sidebar[data-state=collapsed]]:w-auto in-[.sidebar[data-state=collapsed]]:bg-transparent in-[.sidebar[data-state=collapsed]]:p-0 in-[.sidebar[data-state=collapsed]]:shadow-none"
      aria-label={`${title}, ${sub}. Switch business or branch`}
      aria-expanded={props.expanded}
      onPress={props.onPress}
    >
      <Tile ini={ctx.ini} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col" data-sidebar="label">
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className="truncate text-xs leading-4 font-normal text-muted">{sub}</span>
      </span>
      <ChevronsExpandVertical className="size-4 shrink-0 text-muted" aria-hidden="true" data-sidebar="label" />
    </Button>
  );
  const panel = (
    <SwitcherPanel
      persona={persona}
      ctx={ctx}
      branch={branch}
      onBranch={(id) => {
        setBranch(persona.id, id);
        if (!inline) setOpen(false);
      }}
      onNavigate={() => setOpen(false)}
    />
  );
  if (inline) {
    return (
      <div className="flex flex-col gap-2">
        <div className="w-56">{trigger({ onPress: () => setOpen(!open), expanded: open })}</div>
        {open ? <div className="w-fit rounded-2xl bg-overlay shadow-overlay">{panel}</div> : null}
      </div>
    );
  }
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger>{trigger({})}</Popover.Trigger>
      <Popover.Content placement="bottom start" className="rounded-2xl p-0">
        <Popover.Dialog className="p-0">{panel}</Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
