"use client";

import { Display, Flame, Gift, Lock, PencilToSquare, ShieldExclamation, ShoppingCart } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Separator, Switch, Table, Tabs, Toast, toast } from "@heroui/react";
import { EmptyState, KPIGroup, ListView } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import type {
  DepartmentGroup,
  Outlet,
  OutletMenu,
  OutletOffer,
  OutletOrder,
  OutletOrderLoad,
  Persona,
} from "@injishi/product-outlets";
import { useBoardHref } from "@injishi/product-outlets/web";
import {
  formatNumber,
  formatRwf,
  GateChip,
  Icon,
  LinkButton,
  PageContent,
  PageHeader,
  SectionHeader,
  StatusDot,
  toneColor,
} from "@injishi/ui";
import { Fragment, useState } from "react";
import { FieldLabel, firstKey } from "./menu-form-parts";

export type OutletTab = "outlets" | "menus" | "orders" | "offers";

interface OutletsData {
  outlets: Outlet[];
  departments: DepartmentGroup[];
  menus: OutletMenu[];
  orders: OutletOrder[];
  orderLoad: OutletOrderLoad[];
  offers: OutletOffer[];
}

const TABS: { id: OutletTab; label: string }[] = [
  { id: "outlets", label: "Outlets" },
  { id: "menus", label: "Menus" },
  { id: "orders", label: "Orders" },
  { id: "offers", label: "Offers" },
];
/**
 * What this board cannot change yet, said plainly. The outlets and their menus are sample data
 * (`operations.outlets` and `outletMenus` are deferred: an outlet run by another business waits on tenancies,
 * ADR-050, and menus have no versioned drafts). Charge to room is not a column either: it follows from who runs
 * the outlet, and `orderingAccess` on the API decides who may order, not who may sign to a folio. So the switch
 * and "publish" change nothing on screen.
 */
const unavailable = (what: string) =>
  toast.warning(`${what} is not available yet. These outlets and menus are sample data; nothing was changed.`);

export function OutletsMenusView({
  persona: _persona,
  initialTab,
  data,
  placeName,
}: {
  persona: Persona;
  initialTab: OutletTab;
  data: OutletsData;
  /** The branch, else the business, as the API names it. */
  placeName: string;
}) {
  const screenHref = useBoardHref();
  const [tab, setTabState] = useState<OutletTab>(initialTab);
  const [menuId, setMenuId] = useState(data.menus[0]?.id ?? "");
  const [offerId, setOfferId] = useState(data.offers[0]?.id ?? "");

  const setTab = (t: OutletTab) => {
    setTabState(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  };

  // Menus as they are: a draft stays a draft (publishing is not available yet).
  const menus = data.menus.map((m) => {
    return {
      ...m,
      live: false,
      items: m.items.map((i) => {
        const d = i.draft;
        return { ...i, note: d?.price ? `draft ${formatNumber(d.price)}` : "" };
      }),
    };
  });
  const menu = menus.find((m) => m.id === menuId) ?? menus[0];
  const offer = data.offers.find((o) => o.id === offerId) ?? data.offers[0];

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={`${placeName} · Property`}
        title="Outlets & Services"
        description="Who sells what, from which menu, and how it is settled. Each outlet keeps its own merchant identity."
        actions={
          <>
            <LinkButton href={screenHref("KitchenDisplay")} variant="secondary">
              <Flame className="size-4" />
              Kitchen display
            </LinkButton>
            <LinkButton href={screenHref("OutletOrders")} variant="secondary">
              <ShoppingCart className="size-4" />
              Order board
            </LinkButton>
            <LinkButton href={screenHref("POS")}>
              <Display className="size-4" />
              Open POS
            </LinkButton>
          </>
        }
      />

      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as OutletTab)} className="gap-[20px]">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Outlets and services">
            {TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id}>
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="outlets" className="p-0 flex flex-col gap-[20px]">
          <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))]">
            {data.outlets.map((o) => {
              const on = o.chargeAllowed && o.chargeToRoom;
              return (
                <Card key={o.id} aria-label={o.name} className="gap-3 p-[18px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <h2 className="text-base leading-[22px] font-semibold">{o.name}</h2>
                      <span className="text-[12px] text-muted">{o.kind}</span>
                    </div>
                    <Chip size="sm" variant="soft" color={toneColor(o.tone)} className="shrink-0">
                      {o.relation}
                    </Chip>
                  </div>
                  <dl className="m-0 flex flex-col gap-1.5 text-[13px] leading-[18px]">
                    {o.facts.map((f) => (
                      <div key={f.label} className="grid grid-cols-[104px_1fr] gap-2.5">
                        <dt className="text-muted">{f.label}</dt>
                        <dd className="m-0 font-medium">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <Switch
                      isSelected={on}
                      isDisabled={!o.chargeAllowed}
                      onChange={(v) => unavailable(`Turning charge to room ${v ? "on" : "off"} at ${o.name}`)}
                    >
                      <Switch.Content className="text-[14px]">
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        Charge to room
                      </Switch.Content>
                    </Switch>
                    {o.chargeAllowed ? (
                      <p className="text-[12px] leading-4 text-muted" role="status">
                        {on
                          ? `Guests with an active stay and charge privileges can sign to their folio, within the stay’s limit. The line keeps ${o.name} as its department; the hotel issues one fiscal receipt at settlement, never a second at the outlet.`
                          : `Off: guests pay at ${o.name}.`}
                      </p>
                    ) : (
                      <Alert status="warning">
                        <Alert.Indicator>
                          <Lock />
                        </Alert.Indicator>
                        <Alert.Content>
                          <Alert.Title>Not allowed for this outlet</Alert.Title>
                          <Alert.Description>
                            {o.facts.find((f) => f.label === "Merchant")?.value.split(" · ")[0] ?? o.name} is a separate
                            merchant with its own TIN. Its sales cannot go on a hotel folio or a hotel receipt without a
                            signed collection agreement and fiscal set-up, and none is on file. Guests pay {o.name}{" "}
                            directly.
                          </Alert.Description>
                        </Alert.Content>
                      </Alert>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card aria-labelledby="dep-h" className="gap-3 p-[18px]">
            <Card.Header>
              <Card.Title id="dep-h" className="text-[15px] font-semibold">
                Departments
              </Card.Title>
              <Card.Description>Sample · revenue and cost reporting groups, following USALI</Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
              {data.departments.map((d) => (
                <Card key={d.id} variant="secondary" className="gap-1.5 px-3.5 py-3">
                  <FieldLabel>{d.group}</FieldLabel>
                  {d.items.map((x) => (
                    <span key={x.name} className="flex items-start gap-2 text-[13px] leading-[18px]">
                      <StatusDot tone={x.tone} className="mt-[5px]" />
                      <span>
                        <span className="font-medium">{x.name}</span>
                        {x.detail ? <span className="text-muted"> {x.detail}</span> : null}
                      </span>
                    </span>
                  ))}
                </Card>
              ))}
            </Card.Content>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel
          id="menus"
          className="grid grid-cols-1 items-start gap-[16px] p-0 lg:grid-cols-[260px_minmax(0,1fr)]"
        >
          <nav aria-label="Menus">
            <ListView
              variant="secondary"
              aria-label="Menus"
              items={menus}
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection
              selectedKeys={new Set([menu?.id ?? ""])}
              onSelectionChange={(keys) => {
                const k = firstKey(keys);
                if (k) setMenuId(k);
              }}
            >
              {(m) => (
                <ListView.Item id={m.id} textValue={m.outlet}>
                  <ListView.ItemContent>
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title>{m.outlet}</ListView.Title>
                      <ListView.Description>{m.sub}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                </ListView.Item>
              )}
            </ListView>
          </nav>
          {menu ? (
            <Card aria-labelledby="menu-h" className="gap-3 p-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 id="menu-h" className="text-base font-semibold">
                    {menu.name}
                  </h2>
                  <span className="text-[12px] text-muted">{menu.version}</span>
                </div>
                <GateChip icon={<ShieldExclamation className="size-3" />}>Tax rates configured · unverified</GateChip>
              </div>
              {menu.draft && !menu.live ? (
                <Alert status="accent">
                  <Alert.Indicator>
                    <PencilToSquare />
                  </Alert.Indicator>
                  <Alert.Content className="flex-1">
                    <Alert.Title>{menu.draft.title}</Alert.Title>
                    <Alert.Description>{menu.draft.description}</Alert.Description>
                  </Alert.Content>
                  <Button size="sm" onPress={() => unavailable(`“${menu.draft?.action ?? "Publishing"}”`)}>
                    {menu.draft.action}
                  </Button>
                </Alert>
              ) : null}
              {menu.readOnly ? (
                <Alert>
                  <Alert.Indicator>
                    <Lock />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Managed by Ikawa Corner Ltd</Alert.Title>
                    <Alert.Description>
                      Shown here so in-house guests can order through the guest app. Prices, tax and receipts belong to
                      Ikawa Corner.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label={`${menu.name} items`}>
                    <Table.Header>
                      <Table.Column isRowHeader>Item</Table.Column>
                      <Table.Column>Modifiers</Table.Column>
                      <Table.Column className="text-right">Price</Table.Column>
                      <Table.Column>Tax class</Table.Column>
                      <Table.Column>Stock or recipe</Table.Column>
                      <Table.Column>Status</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {menu.items.map((i) => (
                        <Table.Row key={i.name} id={i.name}>
                          <Table.Cell className="min-w-[180px] text-[13px] leading-[18px] font-medium whitespace-normal">
                            {i.name}
                          </Table.Cell>
                          <Table.Cell className="text-[12px] leading-4 whitespace-normal text-muted">
                            {i.modifiers}
                          </Table.Cell>
                          <Table.Cell className="text-right text-[13px] tabular">
                            <span className="flex flex-col items-end">
                              <span className="whitespace-nowrap">{formatRwf(i.price)}</span>
                              {i.note ? <span className="text-[11px] text-muted">{i.note}</span> : null}
                            </span>
                          </Table.Cell>
                          <Table.Cell className="text-[12px]">{i.tax}</Table.Cell>
                          <Table.Cell className="text-[12px] leading-4 whitespace-normal text-muted">
                            {i.stock}
                          </Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={toneColor(i.tone)}>
                              {i.status}
                            </Chip>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </Card>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="orders" className="p-0 flex flex-col gap-[20px]">
          <section aria-label="Open orders by outlet">
            <KPIGroup className="flex-wrap">
              {data.orderLoad.map((k, i) => (
                <Fragment key={k.id}>
                  {i > 0 ? <KPIGroup.Separator /> : null}
                  <KPI className="min-w-[min(200px,100%)] flex-[1_1_200px]">
                    <KPI.Header>
                      <KPI.Title>{k.label}</KPI.Title>
                    </KPI.Header>
                    <KPI.Content className="flex-none">
                      <KPI.Value value={k.value} className="tabular">
                        {(formatted) => `${formatted} ${k.unit}`}
                      </KPI.Value>
                    </KPI.Content>
                    <KPI.Footer className="mt-1.5">
                      <p className="text-[12px] leading-4 text-muted">{k.foot}</p>
                    </KPI.Footer>
                  </KPI>
                </Fragment>
              ))}
            </KPIGroup>
          </section>
          <section className="flex flex-col gap-2.5" aria-labelledby="ord-h">
            <SectionHeader
              id="ord-h"
              title="Live Orders · All Outlets"
              className="items-center"
              action={
                <LinkButton href={screenHref("OutletOrders")} size="sm" variant="ghost">
                  Full order board
                </LinkButton>
              }
            />
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Live orders, all outlets">
                  <Table.Header>
                    <Table.Column isRowHeader>Order</Table.Column>
                    <Table.Column>Source</Table.Column>
                    <Table.Column>Outlet · place</Table.Column>
                    <Table.Column>Items</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column>Age</Table.Column>
                    <Table.Column>Settlement</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.orders.map((r) => (
                      <Table.Row key={r.id} id={r.id}>
                        <Table.Cell className="text-[13px] font-medium whitespace-nowrap tabular">{r.id}</Table.Cell>
                        <Table.Cell className="text-[13px]">
                          <span className="flex items-center gap-1.5">
                            <Icon name={r.icon} className="size-4 shrink-0 text-muted" />
                            {r.source}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-[13px] leading-[18px]">
                          <span className="flex flex-col">
                            <span>{r.outlet}</span>
                            <span className="text-[12px] text-muted">{r.place}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="min-w-[160px] text-[13px] leading-[18px] whitespace-normal">
                          {r.items}
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color={toneColor(r.tone)}>
                            {r.status}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell className="text-[12px] whitespace-nowrap text-muted tabular">{r.age}</Table.Cell>
                        <Table.Cell className="min-w-[min(200px,100%)] text-[12px] leading-4 whitespace-normal">
                          <span className="flex items-start gap-1.5">
                            <StatusDot tone={r.settleTone} className="mt-1" />
                            <span>{r.settlement}</span>
                          </span>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <p className="text-[12px] leading-4 text-muted">
              Guest-app orders need an active stay and are rate-limited; a second identical tap within 10 seconds is
              held for the guest to confirm. A charge posts to a folio once, keyed by the order number, even if the
              outlet retries.
            </p>
          </section>
        </Tabs.Panel>

        <Tabs.Panel
          id="offers"
          className="grid grid-cols-1 items-start gap-[16px] p-0 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]"
        >
          <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby="off-h">
            <SectionHeader id="off-h" title="Offers" />
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Offers"
                  selectionMode="single"
                  selectionBehavior="replace"
                  disallowEmptySelection
                  selectedKeys={new Set([offer?.id ?? ""])}
                  onSelectionChange={(keys) => {
                    const k = firstKey(keys);
                    if (k) setOfferId(k);
                  }}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Offer</Table.Column>
                    <Table.Column>Eligibility</Table.Column>
                    <Table.Column className="text-right">Redeemed</Table.Column>
                    <Table.Column>Status</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.offers.map((f) => (
                      <Table.Row key={f.id} id={f.id} className="cursor-pointer">
                        <Table.Cell className="min-w-[180px] whitespace-normal">
                          <span className="flex flex-col">
                            <span className="text-[13px] font-medium">{f.name}</span>
                            <span className="text-[12px] text-muted">
                              {f.outlet} · {f.valid}
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-[12px] leading-4 whitespace-normal">{f.eligibility}</Table.Cell>
                        <Table.Cell className="text-right text-[13px] tabular">{f.redeemed}</Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color={toneColor(f.tone)}>
                            {f.status}
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <p className="text-[12px] leading-4 text-muted">
              Eligibility is checked at the till against the guest’s active stay or loyalty tier. Staff cannot apply an
              offer to an ineligible guest without a manager, and every redemption is logged.
            </p>
          </section>
          {offer ? (
            <Card aria-labelledby="red-h" className="gap-3 p-[18px]">
              <Card.Header>
                <Card.Title id="red-h" className="text-[15px] font-semibold">
                  Redemptions · {offer.name}
                </Card.Title>
                <Card.Description>{offer.note}</Card.Description>
              </Card.Header>
              <Card.Content>
                {offer.redemptions.length ? (
                  <ListView variant="secondary" aria-label={`Redemptions of ${offer.name}`} items={offer.redemptions}>
                    {(x) => (
                      <ListView.Item id={x.id} textValue={x.who}>
                        <ListView.ItemContent>
                          <div className="flex min-w-0 flex-col">
                            <ListView.Title className="text-[13px]">{x.who}</ListView.Title>
                            <ListView.Description>{x.meta}</ListView.Description>
                          </div>
                        </ListView.ItemContent>
                        <ListView.ItemAction className="flex items-center gap-2">
                          <span className="text-[13px] tabular">{x.value ? formatRwf(x.value) : "—"}</span>
                          <Chip size="sm" variant="soft" color={toneColor(x.tone)}>
                            {x.status}
                          </Chip>
                        </ListView.ItemAction>
                      </ListView.Item>
                    )}
                  </ListView>
                ) : (
                  <EmptyState size="sm">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <Gift className="size-5" />
                      </EmptyState.Media>
                      <EmptyState.Title>No redemptions</EmptyState.Title>
                      <EmptyState.Description>{offer.empty}</EmptyState.Description>
                    </EmptyState.Header>
                  </EmptyState>
                )}
              </Card.Content>
            </Card>
          ) : null}
        </Tabs.Panel>
      </Tabs>
    </PageContent>
  );
}
