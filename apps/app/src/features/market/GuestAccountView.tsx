"use client";

import {
  EyeSlash,
  FileArrowDown,
  Gear,
  Heart,
  HeartFill,
  Lock,
  Magnifier,
  Pencil,
  Persons,
  Plus,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Form,
  Input,
  Label,
  Switch,
  Table,
  Tabs,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, ItemCard, ItemCardGroup, ListView, Segment } from "@heroui-pro/react";
import { type BoardId, screenHref } from "@injishi/data";
import type {
  GuestConsent,
  GuestProfile,
  GuestReviewItem,
  Option,
  PastTrip,
  ReviewToWrite,
  SavedCollection,
  UpcomingTrip,
} from "@injishi/data/fixtures/market";
import { stock } from "@injishi/data/media";
import { Icon, LinkButton, Photo, SectionHeader, TextLink } from "@injishi/ui";
import { type FormEvent, useState, useTransition } from "react";
import {
  createCollectionAction,
  type MarketActionResult,
  removeFromCollectionAction,
  saveContactAction,
  setConsentAction,
  withdrawRequestAction,
} from "./actions";
import { chipColor, propertyHref } from "./format";
import { MarketFooter, MarketHeader, MarketMain, type MarketVisitor } from "./MarketChrome";
import { Stars } from "./stars";

type AccountTab = "trips" | "saved" | "reviews" | "profile";

const REVIEW_COLUMNS: { id: GuestReviewItem["section"]; title: string; foot: string }[] = [
  {
    id: "wrote",
    title: "Reviews You Wrote",
    foot: "Need to change a published review? Contact support",
  },
  {
    id: "about",
    title: "Reviews About You",
    foot: "Think a review about you breaks the rules? Ask for a moderation check",
  },
];

/** Guest account on the web (artifact: GuestAccount.dc.html). */
export function GuestAccountView({
  visitor,
  profile,
  upcoming,
  past,
  collections,
  toWrite,
  reviews,
  consents,
  languages,
}: {
  visitor: MarketVisitor | null;
  profile: GuestProfile;
  upcoming: UpcomingTrip[];
  past: PastTrip[];
  collections: SavedCollection[];
  toWrite: ReviewToWrite[];
  reviews: GuestReviewItem[];
  consents: GuestConsent[];
  languages: Option[];
}) {
  const [tab, setTab] = useState<AccountTab>("trips");
  const [col, setCol] = useState(collections[0]?.id ?? "");
  const [removed, setRemoved] = useState<string[]>([]);
  const [withdrawn, setWithdrawn] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [name, setName] = useState(profile.name);
  const [mobile, setMobile] = useState(profile.mobile);
  const [country, setCountry] = useState(profile.country);
  const [lang, setLang] = useState(profile.language);
  const [pending, startTransition] = useTransition();
  /** Run one write; a refusal is shown, never swallowed. */
  const act = <T,>(run: () => Promise<MarketActionResult<T>>, then?: (value: T) => void) =>
    startTransition(async () => {
      const result = await run();
      if (result.ok) then?.(result.value);
      else toast.danger(result.error);
    });
  const createCollection = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newName.trim()) return;
    act(
      () => createCollectionAction(newName.trim()),
      (id) => {
        setCol(id);
        setCreating(false);
        setNewName("");
      },
    );
  };
  const [consentOn, setConsentOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(consents.map((c) => [c.id, c.on])),
  );

  const collection = collections.find((c) => c.id === col) ?? collections[0];
  const items = collection?.items.filter((it) => !removed.includes(`${collection.id}${it.id}`)) ?? [];

  return (
    <>
      <MarketHeader
        width="regular"
        visitor={visitor}
        returnTo={screenHref("GuestAccount")}
        current="trips"
        account={{ board: "Account", label: "Account settings" }}
        actions={
          <LinkButton href={screenHref("PublicHost")} variant="ghost" size="sm" className="hidden sm:inline-flex">
            List your property
          </LinkButton>
        }
      />
      <MarketMain width="regular" className="gap-5 pt-7">
        <section className="flex flex-wrap items-center gap-4">
          <Avatar variant="soft" color="accent" className="size-14">
            <Avatar.Fallback className="text-lg">{profile.initials}</Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-[320px] flex-1 flex-col gap-0.5">
            <h1 className="text-2xl leading-8 font-semibold tracking-[-0.015em]">{profile.name}</h1>
            <p className="text-sm text-muted">
              {profile.since} · {profile.home} · {profile.signIn}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LinkButton href={screenHref("MarketExplore")} variant="secondary">
              <Magnifier className="size-4" />
              Find a stay
            </LinkButton>
            <LinkButton href={screenHref("Account")} variant="ghost">
              <Gear className="size-4" />
              Account settings
            </LinkButton>
          </div>
        </section>

        <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as AccountTab)}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Your account" className="gap-1">
              <Tabs.Tab id="trips" className="h-10 w-auto flex-none gap-2 px-3 text-sm">
                Trips
                <Chip size="sm" variant="soft">
                  <Chip.Label>{upcoming.length} upcoming</Chip.Label>
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="saved" className="h-10 w-auto flex-none gap-2 px-3 text-sm">
                Saved
                <Chip size="sm" variant="soft">
                  <Chip.Label>{collections.length}</Chip.Label>
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="reviews" className="h-10 w-auto flex-none gap-2 px-3 text-sm">
                Reviews
                <Chip size="sm" variant="soft" color="warning">
                  <Chip.Label>{toWrite.length} to write</Chip.Label>
                </Chip>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="profile" className="h-10 w-auto flex-none px-3 text-sm">
                Profile and privacy
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        {tab === "trips" ? (
          <>
            <section className="flex flex-col gap-3" aria-labelledby="up-h">
              <SectionHeader id="up-h" title="Upcoming" />
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
                {upcoming.map((u) => {
                  const facts =
                    u.withdrawable && withdrawn.includes(u.id) && u.withdrawnFacts ? u.withdrawnFacts : u.facts;
                  return (
                    <Card key={u.id} render={(p) => <article {...p} />} className="flex-row gap-0 overflow-hidden p-0">
                      <div className="relative w-[150px] shrink-0 self-stretch bg-surface-secondary">
                        <Photo image={stock[u.photo]} alt="" fill sizes="150px" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-[18px] py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[15px] font-semibold">{u.name}</span>
                          <span className="text-[13px] text-muted">
                            {u.dates} · {u.room}
                          </span>
                          <span className="text-xs text-muted tabular">{u.ref}</span>
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-xs">
                          {facts.map((f) => (
                            <div key={f.label} className="contents">
                              <dt className="text-muted">{f.label}</dt>
                              <dd className="flex flex-wrap items-center gap-1.5">
                                <Chip size="sm" variant="soft" color={chipColor(f.tone)}>
                                  <Chip.Label>{f.chip}</Chip.Label>
                                </Chip>
                                {f.note ? <span className="text-muted tabular">{f.note}</span> : null}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-auto flex flex-wrap gap-1.5">
                          {u.links.map((l) => (
                            <LinkButton
                              key={l.label}
                              href={screenHref(l.board)}
                              size="sm"
                              variant={l.primary ? "primary" : "secondary"}
                            >
                              {l.label}
                            </LinkButton>
                          ))}
                          {u.withdrawable ? (
                            withdrawn.includes(u.id) ? (
                              <Chip size="sm" variant="soft">
                                <Chip.Label>Request withdrawn · hold released</Chip.Label>
                              </Chip>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                isDisabled={pending}
                                onPress={() =>
                                  act(
                                    () => withdrawRequestAction(u.id),
                                    () => setWithdrawn((cur) => [...cur, u.id]),
                                  )
                                }
                              >
                                Withdraw request
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
            <section className="flex flex-col gap-3" aria-labelledby="past-h">
              <SectionHeader id="past-h" title="Past and cancelled" />
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-labelledby="past-h">
                    <Table.Header>
                      <Table.Column isRowHeader>Stay</Table.Column>
                      <Table.Column>Dates</Table.Column>
                      <Table.Column>Bill and money</Table.Column>
                      <Table.Column>Your review</Table.Column>
                      <Table.Column>
                        <span className="sr-only">Actions</span>
                      </Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {past.map((p) => (
                        <Table.Row key={p.id} id={p.id}>
                          <Table.Cell>
                            <span className="flex items-center gap-2.5">
                              <span className="relative h-10 w-12 shrink-0 overflow-hidden rounded-[10px] bg-surface-secondary">
                                <Photo image={stock[p.photo]} alt="" fill sizes="48px" />
                              </span>
                              <span className="flex flex-col">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-xs text-muted">{p.business}</span>
                              </span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col">
                              <span className="tabular">{p.dates}</span>
                              <span className="text-xs text-muted tabular">{p.ref}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <span className="flex flex-col gap-0.5">
                              <Chip size="sm" variant="soft" color={chipColor(p.money.tone)} className="self-start">
                                <Chip.Label>{p.money.chip}</Chip.Label>
                              </Chip>
                              <span className="text-xs text-muted tabular">{p.money.note}</span>
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={chipColor(p.review.tone)}>
                              <Chip.Label>{p.review.chip}</Chip.Label>
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="text-right">
                            <LinkButton
                              href={screenHref(p.action.board)}
                              size="sm"
                              variant={p.action.primary ? "primary" : "ghost"}
                            >
                              {p.action.label}
                            </LinkButton>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </section>
          </>
        ) : null}

        {tab === "saved" ? (
          <div className="flex flex-wrap items-start gap-5">
            <section className="flex min-w-[min(280px,100%)] flex-[0_1_340px] flex-col gap-2.5" aria-labelledby="col-h">
              <div className="flex items-center justify-between gap-2">
                <SectionHeader id="col-h" title="Collections" />
                <Button variant="ghost" size="sm" aria-expanded={creating} onPress={() => setCreating((v) => !v)}>
                  <Plus className="size-4" />
                  New collection
                </Button>
              </div>
              {creating ? (
                <Form aria-label="New collection" className="flex items-end gap-2" onSubmit={createCollection}>
                  <TextField fullWidth value={newName} onChange={setNewName} className="gap-1">
                    <Label htmlFor="new-col">Name</Label>
                    <Input id="new-col" placeholder="Kigali weekend" autoFocus />
                  </TextField>
                  <Button type="submit" size="sm" isDisabled={pending || !newName.trim()}>
                    Create
                  </Button>
                </Form>
              ) : null}
              {collections.map((c) => {
                const left = c.items.filter((it) => !removed.includes(`${c.id}${it.id}`)).length;
                const selected = c.id === collection?.id;
                return (
                  <ItemCard<"button">
                    key={c.id}
                    render={(props) => <button type="button" {...props} />} // heroui-ok
                    aria-pressed={selected}
                    onClick={() => setCol(c.id)}
                    className={`w-full text-left ${selected ? "outline-2 outline-accent" : ""}`}
                  >
                    <span className="relative h-12 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-secondary">
                      <Photo image={stock[c.photo]} alt="" fill sizes="56px" />
                    </span>
                    <ItemCard.Content>
                      <ItemCard.Title>{c.name}</ItemCard.Title>
                      <ItemCard.Description>
                        {c.visibility} · {left} {c.noun}
                      </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                      <Icon name="ChevronRight" className="size-4 text-muted" />
                    </ItemCard.Action>
                  </ItemCard>
                );
              })}
              <p className="text-xs leading-[17px] text-muted">
                Collections are private unless you share them. Hosts never see who saved their listing.
              </p>
            </section>
            {collection ? (
              <Card className="min-w-0 flex-[1_1_520px] gap-3 p-[18px]" aria-labelledby="cold-h">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <h2 id="cold-h" className="text-[15px] leading-[22px] font-semibold">
                      {collection.name}
                    </h2>
                    <span className="text-xs text-muted">
                      {collection.visibility} · {collection.items.length} {collection.noun}
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => toast.warning("Sharing a list is not available yet. Nothing was shared.")}
                  >
                    <Persons className="size-4" />
                    Share
                  </Button>
                </div>
                {items.length ? (
                  <ListView
                    aria-label={collection.name}
                    variant="secondary"
                    items={items.map((it) => ({ ...it, key: it.id }))}
                  >
                    {(it) => (
                      <ListView.Item id={it.id} textValue={it.name} className="items-center">
                        <ListView.ItemContent className="items-center gap-3">
                          <span className="relative h-[52px] w-16 shrink-0 overflow-hidden rounded-xl bg-surface-secondary">
                            <Photo image={stock[it.photo]} alt="" fill sizes="64px" />
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <ListView.Title className="font-medium">
                              <TextLink href={placeHref(it.board, it.id)}>{it.name}</TextLink>
                            </ListView.Title>
                            <ListView.Description className="text-xs">{it.line}</ListView.Description>
                          </span>
                        </ListView.ItemContent>
                        <Chip size="sm" variant="soft" color={chipColor(it.tone)}>
                          <Chip.Label>{it.note}</Chip.Label>
                        </Chip>
                        <ListView.ItemAction>
                          <Button
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            aria-label={`Remove ${it.name} from ${collection.name}`}
                            isDisabled={pending}
                            onPress={() =>
                              act(
                                () => removeFromCollectionAction(collection.id, it.id),
                                () => setRemoved((cur) => [...cur, `${collection.id}${it.id}`]),
                              )
                            }
                          >
                            <HeartFill className="size-4 text-danger" />
                          </Button>
                        </ListView.ItemAction>
                      </ListView.Item>
                    )}
                  </ListView>
                ) : (
                  <EmptyState size="sm">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <Heart />
                      </EmptyState.Media>
                      <EmptyState.Title>Nothing saved here yet</EmptyState.Title>
                      <EmptyState.Description>Tap the heart on any stay or home to add it.</EmptyState.Description>
                    </EmptyState.Header>
                    <EmptyState.Content>
                      <LinkButton href={screenHref("MarketExplore")} variant="secondary" size="sm">
                        Explore stays
                      </LinkButton>
                    </EmptyState.Content>
                  </EmptyState>
                )}
              </Card>
            ) : null}
          </div>
        ) : null}

        {tab === "reviews" ? (
          <>
            <Alert status="accent">
              <Alert.Indicator>
                <EyeSlash />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Reviews are double-blind</Alert.Title>
                <Alert.Description>
                  You and the host review each other without seeing the other’s review. Both appear when both are
                  written, or 14 days after check-out, whichever comes first. Only completed stays can be reviewed.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <ItemCardGroup layout="list" aria-labelledby="todo-h">
              <ItemCardGroup.Header>
                <ItemCardGroup.Title id="todo-h">Waiting for You</ItemCardGroup.Title>
              </ItemCardGroup.Header>
              {toWrite.map((r) => (
                <ItemCard key={r.id}>
                  <ItemCard.Icon>
                    <Pencil />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>{r.title}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{r.desc}</ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action className="flex items-center gap-2">
                    <Chip size="sm" variant="soft" color={chipColor(r.tone)}>
                      <Chip.Label>{r.chip}</Chip.Label>
                    </Chip>
                    <LinkButton href={screenHref(r.board)} size="sm">
                      Write review
                    </LinkButton>
                  </ItemCard.Action>
                </ItemCard>
              ))}
            </ItemCardGroup>
            <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
              {REVIEW_COLUMNS.map((colDef) => (
                <Card key={colDef.id} className="gap-3 p-[18px]">
                  <SectionHeader title={colDef.title} />
                  {reviews
                    .filter((r) => r.section === colDef.id)
                    .map((ri) => (
                      <Card key={ri.id} variant="secondary" className="gap-2 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex flex-col">
                            <span className="font-semibold">{ri.who}</span>
                            <span className="text-xs text-muted">{ri.when}</span>
                          </span>
                          <Chip size="sm" variant="soft" color={chipColor(ri.tone)}>
                            <Icon name={ri.icon} className="size-3" />
                            <Chip.Label>{ri.state}</Chip.Label>
                          </Chip>
                        </div>
                        {ri.visible && ri.score !== null ? (
                          <>
                            <Stars
                              value={ri.score}
                              label={
                                colDef.id === "wrote" ? `You rated ${ri.score} out of 5` : `Rated ${ri.score} out of 5`
                              }
                            />
                            <p className="text-[13px] leading-[19px]">{ri.text}</p>
                          </>
                        ) : (
                          <p className="flex items-center gap-1.5 text-[13px] text-muted">
                            <Lock className="size-3.5" aria-hidden="true" />
                            {ri.text}
                          </p>
                        )}
                      </Card>
                    ))}
                  <TextLink href={screenHref("PublicHelp")} className="text-xs text-muted">
                    {colDef.foot}
                  </TextLink>
                </Card>
              ))}
            </div>
          </>
        ) : null}

        {tab === "profile" ? (
          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
            <Card className="gap-3.5 p-5" aria-labelledby="prof-h">
              <Card.Header>
                <Card.Title id="prof-h" className="text-[15px] font-semibold">
                  Profile
                </Card.Title>
                <Card.Description>Shared with a host only when you book with them</Card.Description>
              </Card.Header>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
                <TextField fullWidth value={name} onChange={setName} className="gap-1">
                  <Label htmlFor="p-name">Full name</Label>
                  <Input id="p-name" />
                </TextField>
                <TextField fullWidth defaultValue={profile.email} isReadOnly className="gap-1">
                  <Label htmlFor="p-mail">Email</Label>
                  <Input id="p-mail" />
                </TextField>
                <TextField fullWidth value={mobile} onChange={setMobile} className="gap-1">
                  <Label htmlFor="p-phone">Mobile</Label>
                  <Input id="p-phone" />
                </TextField>
                <TextField fullWidth value={country} onChange={setCountry} className="gap-1">
                  <Label htmlFor="p-country">Country</Label>
                  <Input id="p-country" />
                </TextField>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Language</span>
                <Segment aria-label="Language" selectedKey={lang} onSelectionChange={(k) => setLang(String(k))}>
                  {languages.map((l, i) => (
                    <Segment.Item key={l.id} id={l.id}>
                      {i > 0 ? <Segment.Separator /> : null}
                      {l.label}
                    </Segment.Item>
                  ))}
                </Segment>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  isDisabled={pending}
                  onPress={() =>
                    act(
                      () => saveContactAction({ name, phone: mobile, country, locale: lang }),
                      () => toast.success("Profile saved"),
                    )
                  }
                >
                  Save profile
                </Button>
              </div>
            </Card>
            <Card className="gap-1.5 p-5" aria-labelledby="cons-h">
              <Card.Header className="mb-1.5">
                <Card.Title id="cons-h" className="text-[15px] font-semibold">
                  Privacy and Consents
                </Card.Title>
                <Card.Description>Change these at any time. Each change is recorded with its date.</Card.Description>
              </Card.Header>
              {consents.map((c) => (
                <div key={c.id} className="flex items-start gap-3 border-t border-separator py-2.5">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs leading-4 text-muted">{c.desc}</span>
                  </div>
                  <Switch
                    aria-label={c.label}
                    isSelected={consentOn[c.id] ?? c.on}
                    isDisabled={c.locked || pending}
                    onChange={(on) =>
                      act(
                        () => setConsentAction(c.id, on),
                        () => setConsentOn((cur) => ({ ...cur, [c.id]: on })),
                      )
                    }
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>
              ))}
              <Card variant="secondary" className="mt-2 gap-2 p-3.5">
                <span className="text-[13px] font-semibold">Your data</span>
                <span className="text-xs leading-[17px] text-muted">
                  Ask for a copy, a correction or deletion of your personal data.
                </span>
                <div className="flex flex-wrap gap-2">
                  <LinkButton href={screenHref("Account")} variant="secondary" size="sm">
                    <FileArrowDown className="size-4" />
                    Data requests
                  </LinkButton>
                  <LinkButton href={screenHref("PublicHelp")} variant="ghost" size="sm">
                    Privacy notice
                  </LinkButton>
                </div>
              </Card>
            </Card>
          </div>
        ) : null}
      </MarketMain>
      <MarketFooter width="regular" links={3} />
      <Toast.Provider placement="bottom" />
    </>
  );
}

/** A saved place with a page opens it (its id is the page's slug); any other returns to explore. */
function placeHref(board: BoardId, id: string) {
  if (board === "MarketProperty") return propertyHref(id);
  return screenHref(board);
}
