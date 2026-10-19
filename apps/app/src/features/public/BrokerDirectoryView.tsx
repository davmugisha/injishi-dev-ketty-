"use client";

import {
  Briefcase,
  CircleCheckFill,
  Clock,
  Envelope,
  Eye,
  FileArrowDown,
  Handset,
  House,
  Lock,
  Plus,
  ScalesBalanced,
  SealCheck,
} from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Modal, SearchField, Switch, Table, Toast, toast } from "@heroui/react";
import { EmptyState, RadioButtonGroup, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  BrokerCredits,
  BrokerFeeTerm,
  CreditLogEntry,
  CreditPack,
  DirectoryListing,
} from "@injishi/data/fixtures/public";
import { stock } from "@injishi/data/media";
import {
  formatNumber,
  formatRwf,
  GateChip,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  Photo,
  TextLink,
  toneColor,
} from "@injishi/ui";
import { type Key, useState } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { CaptionedPhoto } from "./PublicChrome";
import { Pending, PRICING_PENDING } from "./shared";

export interface BrokerDirectoryData {
  credits: BrokerCredits[];
  fees: BrokerFeeTerm[];
  listings: DirectoryListing[];
  log: CreditLogEntry[];
  packs: CreditPack[];
}

const TYPES = [
  { id: "all", label: "All" },
  { id: "apartment", label: "Apartments" },
  { id: "house", label: "Houses" },
  { id: "studio", label: "Studios" },
] as const;

type HomeType = (typeof TYPES)[number]["id"];

/**
 * Why a reveal changes nothing yet: the directory on this page is the prototype's (data map public.directoryListings
 * is deferred until the broker placement lifecycle is decided), so revealing would send a sample listing to the API
 * (`POST /ops/broker/directory/:listingId/reveal`). No credit is taken and no contact is shown.
 */
const REVEAL_UNAVAILABLE = "Revealing a landlord's contact is not available yet. No credits were used.";

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const key = [...keys][0];
  return key == null ? null : String(key);
}

function rentLabel(listing: Pick<DirectoryListing, "rentFrom" | "rentTo">): string {
  if (listing.rentTo == null) return formatRwf(listing.rentFrom);
  return `RWF ${formatNumber(listing.rentFrom)} – ${formatNumber(listing.rentTo)}`;
}

function costText(cost: number): string {
  return `${cost} ${cost === 1 ? "credit" : "credits"}`;
}

function creditDelta(credits: number): string {
  if (credits > 0) return `+${credits}`;
  if (credits < 0) return `−${Math.abs(credits)}`;
  return "0";
}

function contactOf(listing: DirectoryListing, revealed: boolean): { text: string; sub: string } {
  if (listing.policy === "mandate" && listing.phone) {
    return { text: listing.phone, sub: "Shared under your mandate" };
  }
  if (listing.blockReason) return { text: "Not available", sub: listing.policyLabel };
  if (revealed && listing.phone) return { text: listing.phone, sub: "Revealed" };
  return { text: costText(listing.cost), sub: "to reveal" };
}

function policyColor(listing: DirectoryListing): "success" | "accent" | "default" {
  if (listing.policy === "mandate") return "success";
  if (listing.blockReason) return "default";
  return "accent";
}

/** Broker · directory and credits (artifact: BrokerDirectory.dc.html) — listings, reveals and credit packs. */
export function BrokerDirectoryView({ data }: { data: BrokerDirectoryData }) {
  const account = data.credits[0];
  // Credits come from the server, never from arithmetic here; while the directory is sample data the balance is
  // the account's as read, and a reveal changes nothing (see REVEAL_UNAVAILABLE).
  const balance = account?.balance ?? 0;
  const [selectedId, setSelectedId] = useState("kiyovu");
  const revealed = data.listings.filter((listing) => listing.revealed).map((listing) => listing.id);
  const [type, setType] = useState<HomeType>("all");
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [buy, setBuy] = useState(false);
  const [pack, setPack] = useState("p25");

  const q = query.trim().toLowerCase();
  const rows = data.listings.filter((listing) => {
    if (type !== "all" && listing.type !== type) return false;
    if (q && !`${listing.name} ${listing.area}`.toLowerCase().includes(q)) return false;
    if (openOnly && listing.policy !== "open" && listing.policy !== "mandate") return false;
    return true;
  });
  const selected = data.listings.find((listing) => listing.id === selectedId) ?? data.listings[0];
  const revealedIds = new Set(revealed);
  const used = account?.usedThisMonth ?? 0;
  const reveals = account?.revealsThisMonth ?? 0;
  const shown = selected ? revealedIds.has(selected.id) || selected.policy === "mandate" : false;
  const canReveal = !!selected && !shown && !selected.blockReason;
  const short = !!selected && balance < selected.cost;
  const log: CreditLogEntry[] = data.log;

  const pick = (id: string) => setSelectedId(id);

  return (
    <PageContent>
      <TopbarStatus kind="chip" tone="default" icon="Ticket" label={`${balance} credits`} />
      <PageHeader
        eyebrow="Residence listings · Kigali"
        title="Directory and Credits"
        description="Homes from verified landlords. Revealing a landlord’s contact uses credits, and the cost is shown before you confirm."
        actions={
          <>
            <LinkButton href={screenHref("BrokerWork")} variant="secondary">
              <ScalesBalanced className="size-4" />
              Disputes
            </LinkButton>
            <Button onPress={() => setBuy(true)}>
              <Plus className="size-4" />
              Buy credits
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-stretch gap-4">
        <Card className="min-w-0 flex-[1_1_300px] gap-2.5 p-[18px]" aria-labelledby="bal-h">
          <h2 id="bal-h" className="text-[13px] leading-[18px] font-medium text-muted">
            Credit balance
          </h2>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] leading-[38px] font-[650] tabular">{balance}</span>
            <span className="text-muted">credits</span>
          </div>
          <KeyValueList
            className="gap-x-3 gap-y-1 text-[12px]"
            items={[
              {
                label: "Used this month",
                value: (
                  <span className="tabular">
                    {used} credits · {reveals} reveals
                  </span>
                ),
              },
              { label: "Returned after disputes", value: <span className="tabular">{account?.returned}</span> },
              { label: "Credit price and expiry", value: <Pending /> },
            ]}
          />
        </Card>
        <Card variant="secondary" className="min-w-0 flex-[2_1_560px] gap-2.5 p-[18px]" aria-labelledby="fees-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="fees-h" className="text-[15px] leading-[22px] font-semibold">
              What You Pay, and When
            </h2>
            <GateChip icon={<Clock className="size-3" />}>Injishi prices awaiting approval</GateChip>
          </div>
          <dl className="grid gap-x-6 gap-y-2.5 text-[13px] [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
            {data.fees.map((fee) => (
              <div key={fee.id} className="flex flex-col gap-0.5">
                <dt className="font-semibold">{fee.label}</dt>
                <dd className="m-0 leading-[18px] text-muted">
                  {fee.value === PRICING_PENDING ? <Pending /> : fee.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          aria-label="Search listings"
          value={query}
          onChange={setQuery}
          className="w-full max-w-[360px] flex-[1_1_280px]"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search by name or area" />
          </SearchField.Group>
        </SearchField>
        <Segment
          aria-label="Home type"
          selectedKey={type}
          onSelectionChange={(key) => setType(String(key) as HomeType)}
        >
          {TYPES.map((item, index) => (
            <Segment.Item key={item.id} id={item.id}>
              {index > 0 ? <Segment.Separator /> : null}
              {item.label}
            </Segment.Item>
          ))}
        </Segment>
        <Switch isSelected={openOnly} onChange={setOpenOnly} size="sm">
          <Switch.Content className="gap-2 text-[13px] font-normal">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Only listings open to brokers
          </Switch.Content>
        </Switch>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[2_1_620px]">
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Directory listings"
                selectionMode="single"
                selectedKeys={selected ? new Set([selected.id]) : new Set()}
                onSelectionChange={(keys) => {
                  const id = firstKey(keys);
                  if (id) pick(id);
                }}
              >
                <Table.Header>
                  <Table.Column isRowHeader>Listing</Table.Column>
                  <Table.Column>Units and rent</Table.Column>
                  <Table.Column>Landlord</Table.Column>
                  <Table.Column>Brokers</Table.Column>
                  <Table.Column className="text-right">Contact</Table.Column>
                </Table.Header>
                <Table.Body>
                  {rows.map((listing) => {
                    const contact = contactOf(listing, revealedIds.has(listing.id));
                    return (
                      <Table.Row key={listing.id} id={listing.id}>
                        <Table.Cell>
                          <Button
                            variant="ghost"
                            className="h-auto min-h-0 justify-start gap-2.5 px-0 font-normal"
                            aria-pressed={listing.id === selected?.id}
                            onPress={() => pick(listing.id)}
                          >
                            <span className="relative block h-10 w-12 shrink-0 overflow-hidden rounded-[10px] bg-surface-secondary">
                              <Photo image={stock[listing.photo]} fill sizes="48px" />
                            </span>
                            <span className="flex flex-col items-start">
                              <span className="font-medium">{listing.name}</span>
                              <span className="text-[12px] text-muted">{listing.area}</span>
                            </span>
                          </Button>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="whitespace-nowrap tabular">{rentLabel(listing)}</span>
                            <span className="text-[12px] text-muted">{listing.units}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col gap-0.5">
                            <span>{listing.landlord}</span>
                            <span className="flex items-center gap-1 text-[12px] text-accent-soft-foreground">
                              <SealCheck className="size-3" aria-hidden="true" />
                              Verified
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color={policyColor(listing)}>
                            <Chip.Label>{listing.policyLabel}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <span className="flex flex-col items-end">
                            <span className="font-medium whitespace-nowrap tabular">{contact.text}</span>
                            <span className="text-[12px] text-muted">{contact.sub}</span>
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          {rows.length === 0 ? (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <House className="size-5" />
                </EmptyState.Media>
                <EmptyState.Title>No listings match</EmptyState.Title>
                <EmptyState.Description>Clear the search or show all home types.</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : null}
        </div>

        {selected ? (
          <Card
            className="min-w-0 flex-[1_1_320px] gap-0 overflow-hidden p-0"
            aria-labelledby="ins-h"
            render={(props) => <aside {...props} />}
          >
            <CaptionedPhoto
              image={stock[selected.photo]}
              caption={selected.caption}
              className="h-[120px] rounded-none"
              sizes="360px"
            />
            <div className="flex flex-col gap-3 px-[18px] pt-4 pb-[18px]">
              <div className="flex flex-col gap-0.5">
                <h2 id="ins-h" className="text-[16px] leading-[22px] font-semibold">
                  {selected.name}
                </h2>
                <span className="text-[12px] text-muted">{selected.area}</span>
              </div>
              <KeyValueList
                className="text-[12px]"
                items={[
                  { label: "Units", value: selected.units },
                  { label: "Rent", value: <span className="tabular">{rentLabel(selected)}</span> },
                  { label: "Available", value: selected.available },
                  { label: "Landlord", value: `${selected.landlord} · verified ${selected.verified}` },
                  { label: "Fee if placed", value: selected.fee },
                ]}
              />
              {shown ? (
                <>
                  <Card variant="secondary" className="gap-1.5 px-3.5 py-3">
                    <span className="text-[13px] font-semibold">Landlord contact</span>
                    {selected.phone ? (
                      <span className="flex items-center gap-2 text-[13px]">
                        <Handset className="size-4" aria-hidden="true" />
                        <span className="tabular">{selected.phone}</span>
                      </span>
                    ) : null}
                    {selected.email ? (
                      <span className="flex items-center gap-2 text-[13px]">
                        <Envelope className="size-4" aria-hidden="true" />
                        <span>{selected.email}</span>
                      </span>
                    ) : null}
                    <span className="text-[12px] text-muted">{selected.note}</span>
                  </Card>
                  <TextLink href={screenHref("BrokerWork")} className="text-[12px]">
                    Contact wrong? Open a dispute
                  </TextLink>
                </>
              ) : null}
              {canReveal ? (
                <>
                  <Button isDisabled={short} onPress={() => toast.warning(REVEAL_UNAVAILABLE)}>
                    <Eye className="size-4" />
                    Reveal contact · {costText(selected.cost)}
                  </Button>
                  {short ? (
                    <span className="text-[12px] text-muted">Not enough credits. Buy credits to continue.</span>
                  ) : null}
                </>
              ) : null}
              {selected.blockReason ? (
                <Alert status="default">
                  <Alert.Indicator>
                    <Lock />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>{selected.policyLabel}</Alert.Title>
                    <Alert.Description>{selected.blockReason}</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
              {selected.policy === "mandate" ? (
                <LinkButton href={screenHref("BrokerWork")} variant="secondary">
                  <Briefcase className="size-4" />
                  Open in My work
                </LinkButton>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>

      <section className="flex flex-col gap-2.5" aria-labelledby="log-h">
        <div className="flex items-center justify-between gap-2">
          <h2 id="log-h" className="text-[15px] leading-[22px] font-semibold">
            Reveal and Credit Log
          </h2>
          <Button size="sm" variant="ghost">
            <FileArrowDown className="size-4" />
            Export
          </Button>
        </div>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-labelledby="log-h">
              <Table.Header>
                <Table.Column isRowHeader>When</Table.Column>
                <Table.Column>What</Table.Column>
                <Table.Column className="text-right">Credits</Table.Column>
                <Table.Column>Outcome</Table.Column>
                <Table.Column>Reference</Table.Column>
              </Table.Header>
              <Table.Body>
                {log.map((entry) => (
                  <Table.Row key={entry.id} id={entry.id}>
                    <Table.Cell className="tabular">{entry.when}</Table.Cell>
                    <Table.Cell>{entry.what}</Table.Cell>
                    <Table.Cell className="text-right font-medium tabular">{creditDelta(entry.credits)}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(entry.tone)}>
                        <Chip.Label>{entry.outcome}</Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-muted tabular">{entry.ref}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <Modal.Backdrop isOpen={buy} onOpenChange={(open) => (open ? setBuy(true) : setBuy(false))}>
        <Modal.Container>
          <Modal.Dialog aria-labelledby="buy-h" className="gap-4 sm:max-w-[480px]">
            <Modal.CloseTrigger aria-label="Close" />
            <Modal.Header>
              <Modal.Heading id="buy-h" className="text-[18px] leading-[26px] font-[650]">
                Buy credits
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="gap-4">
              <RadioButtonGroup
                aria-label="Credit pack"
                value={pack}
                onChange={(value) => {
                  if (value) setPack(value);
                }}
                className="flex flex-col gap-2"
              >
                {data.packs.map((item) => (
                  <RadioButtonGroup.Item key={item.id} value={item.id} className="items-center px-4 py-3 text-left">
                    <RadioButtonGroup.Indicator>
                      <CircleCheckFill className="size-4 text-accent" />
                    </RadioButtonGroup.Indicator>
                    <RadioButtonGroup.ItemContent className="flex flex-row items-center justify-between gap-3">
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">{item.credits} credits</span>
                        <span className="text-[12px] text-muted">{item.note}</span>
                      </span>
                      <Pending className="text-[12px]" />
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>
              <p className="text-[12px] leading-[17px] text-muted">
                Credits are bought from Injishi, not from a landlord. You’ll pay with MTN MoMo, Airtel Money or card,
                and the credits are added only after the payment is verified.
              </p>
              <Alert status="warning">
                <Alert.Indicator>
                  <Clock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Purchases open once prices are approved</Alert.Title>
                  <Alert.Description>
                    Credit prices are still being agreed, so packs are not on sale yet. Your current balance keeps
                    working.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            </Modal.Body>
            <Modal.Footer className="justify-end gap-2">
              <Button variant="ghost" onPress={() => setBuy(false)}>
                Close
              </Button>
              <Button isDisabled>Continue to payment</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
