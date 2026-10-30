"use client";

import { Alert, Card, Description, Label, Toast, toast } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import {
  buildLeaseContract,
  type LandlordProfileView,
  type RentalPropertyView,
  type RentalUnitView,
  type TenantView,
} from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  DateText,
  EmptyBlock,
  FlowStepper,
  formatMoney,
  Icon,
  KeyValueList,
  Money,
  PageContent,
  PageHeader,
  SearchBar,
  SectionCard,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { bedroomsWords, settingsHref } from "../rentals/shared";
import { createLease, searchTenants } from "./actions";
import { type BrokerDraft, BrokerPicker, brokerBody, brokerProblems, noBroker } from "./BrokerPicker";
import { ContractDocument } from "./ContractDocument";
import {
  emptyTenant,
  newTerms,
  OccupantsFields,
  occupantProblems,
  type TenantDraft,
  TenantFields,
  type TermsDraft,
  TermsFields,
  tenantBody,
  tenantProblems,
  termsBody,
  termsProblems,
} from "./LeaseForm";
import { leaseHref } from "./shared";

const STEPS = [
  { id: "unit", title: "Unit", description: "Which home" },
  { id: "tenant", title: "Tenant", description: "Who rents it" },
  { id: "terms", title: "Terms", description: "Dates and money" },
  { id: "people", title: "Occupants", description: "And other terms" },
  { id: "review", title: "Review", description: "Read it through" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

/** Which step owns a field the API refused. */
function stepOf(field: string): number {
  if (field === "unitId") return 0;
  if (field.startsWith("broker") || field === "placementId") return 1;
  if (field.startsWith("tenant") || field === "confirmEmail") return 1;
  if (field.startsWith("terms.occupants") || field === "terms.otherTerms") return 3;
  if (field.startsWith("terms")) return 2;
  return 4;
}

/** The API names a new tenant's fields `tenant.email`; the form names them `email`. */
function tenantErrors(errors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(errors)) if (k.startsWith("tenant.")) out[k.slice(7)] = v;
  return out;
}

function unitWords(u: RentalUnitView): string {
  return [u.blockName ?? u.blockCode, bedroomsWords(u.bedrooms), u.askingRentRwf ? formatMoney(u.askingRentRwf) : null]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A new lease (WP 2.4), one step at a time: the unit, the tenant (one already known to the business, or
 * someone new, with the email checked for typos), the terms within the calendar rules, who else lives
 * there, and a read-through of the contract as it will be written. Creating it opens the record with the
 * signing panel; the API checks every rule again.
 */
export function NewLeaseView({
  units,
  properties,
  profile,
  today,
  initialUnitId,
  initialStart = null,
  canSign,
}: {
  units: RentalUnitView[];
  properties: RentalPropertyView[];
  profile: LandlordProfileView;
  today: string;
  initialUnitId: string | null;
  /** The first day, from a day chosen on the landlord's calendar. */
  initialStart?: string | null;
  canSign: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [unitId, setUnitId] = useState<string | null>(
    initialUnitId && units.some((u) => u.id === initialUnitId)
      ? initialUnitId
      : units.length === 1
        ? units[0].id
        : null,
  );
  const unit = units.find((u) => u.id === unitId) ?? null;
  const [who, setWho] = useState<"existing" | "new">("new");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [known, setKnown] = useState<TenantView[] | null>(null);
  const [lookFor, setLookFor] = useState("");
  const [tenant, setTenant] = useState<TenantDraft>(emptyTenant);
  const [terms, setTerms] = useState<TermsDraft>(() => ({
    ...newTerms(unit, profile.leaseDefaults),
    ...(initialStart ? { startDate: initialStart } : {}),
  }));
  const [broker, setBroker] = useState<BrokerDraft>(noBroker);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const typing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const termsTouched = useRef(false);

  // The business's tenants, for "Someone you know": the latest first, then as the search narrows.
  useEffect(() => {
    let live = true;
    searchTenants("").then((r) => live && setKnown(r.ok ? r.value : []));
    return () => {
      live = false;
    };
  }, []);
  const onLookFor = (value: string) => {
    setLookFor(value);
    if (typing.current) clearTimeout(typing.current);
    typing.current = setTimeout(() => {
      searchTenants(value).then((r) => setKnown(r.ok ? r.value : []));
    }, 300);
  };
  const chosen = known?.find((t) => t.id === tenantId) ?? null;

  const pickUnit = (id: string) => {
    setUnitId(id);
    const next = units.find((u) => u.id === id) ?? null;
    // The rent and deposit follow the unit until the landlord types their own.
    if (!termsTouched.current)
      setTerms((t) => ({
        ...t,
        monthlyRentRwf: next?.askingRentRwf ?? null,
        depositRwf: next?.askingDepositRwf ?? null,
      }));
  };

  const property = properties.find((p) => p.id === unit?.propertyId) ?? properties[0] ?? null;
  const signatoryReady = Boolean(
    profile.signatory.name &&
      profile.signatory.idNumber &&
      profile.signatory.contactPhone &&
      profile.signatory.contactEmail,
  );

  const preview = useMemo(() => {
    if (!unit || !terms.startDate || !terms.endDate) return null;
    const party =
      who === "existing" && chosen
        ? {
            fullName: chosen.fullName,
            idKind: chosen.idKind ?? "national_id",
            idNumber: chosen.idNumber ?? "",
            nationality: chosen.nationality ?? "",
            phone: chosen.phone ?? "",
            email: chosen.email ?? "",
          }
        : {
            ...tenantBody(tenant),
            idNumber: tenant.idNumber.replace(/[\s-]/g, "").toUpperCase(),
            email: tenant.email.trim().toLowerCase(),
          };
    const body = termsBody(terms);
    return buildLeaseContract(
      {
        landlord: {
          legalName: profile.legalName,
          signatoryName: profile.signatory.name ?? profile.legalName,
          idNumber: profile.signatory.idNumber ?? profile.tin ?? "",
          phone: profile.signatory.contactPhone ?? "",
          email: profile.signatory.contactEmail ?? "",
        },
        tenant: { ...party, phone: party.phone ?? "" },
        premises: {
          property: property?.name ?? unit.propertyName,
          unit: unit.label,
          block: unit.blockCode,
          street: property?.street ?? null,
          village: property?.place.village?.name ?? null,
          cell: property?.place.cell?.name ?? null,
          sector: property?.place.sector?.name ?? null,
          district: property?.place.district?.name ?? null,
          province: property?.place.province?.name ?? null,
        },
        terms: body,
      },
      new Date(),
    );
  }, [unit, terms, who, chosen, tenant, profile, property]);

  const check = (index: number): Record<string, string> => {
    if (index === 0) return unit ? {} : { unitId: "Pick the unit." };
    if (index === 1) {
      const fromBroker = brokerProblems(broker);
      if (who === "existing")
        return chosen ? fromBroker : { tenantId: "Pick the tenant, or add someone new.", ...fromBroker };
      const problems = tenantProblems(tenant);
      return { ...Object.fromEntries(Object.entries(problems).map(([k, v]) => [`tenant.${k}`, v])), ...fromBroker };
    }
    if (index === 2) return termsProblems(terms, today, { isNew: true });
    if (index === 3) return occupantProblems(terms);
    return {};
  };

  const goTo = (index: number) => {
    setFormError(null);
    setStep(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const problems = check(step);
    setErrors(problems);
    if (Object.keys(problems).length > 0) {
      setFormError(problems["tenant.emailTypo"] ? "Use the suggested email, or keep it as typed." : null);
      return;
    }
    goTo(step + 1);
  };

  const create = () =>
    start(async () => {
      for (let i = 0; i < 4; i++) {
        const problems = check(i);
        if (Object.keys(problems).length > 0) {
          setErrors(problems);
          goTo(i);
          return;
        }
      }
      const result = await createLease({
        unitId,
        ...(who === "existing" ? { tenantId } : { tenant: tenantBody(tenant) }),
        ...(who === "new" && tenant.keepEmail ? { confirmEmail: true } : {}),
        terms: termsBody(terms),
        ...brokerBody(broker),
      });
      if (!result.ok) {
        const fields = result.fieldErrors ?? {};
        const keys = Object.keys(fields).filter((k) => k !== "_");
        setErrors(fields);
        if (keys.length > 0) {
          setStep(Math.min(...keys.map(stepOf)));
          setFormError(null);
        } else {
          setFormError(result.error);
        }
        return;
      }
      toast.success(`Lease ${result.value.reference} drafted`);
      router.push(canSign ? `${leaseHref(result.value.id)}?open=sign` : leaseHref(result.value.id));
    });

  if (units.length === 0) {
    return (
      <PageContent>
        <PageHeader title="New lease" eyebrow={<BackToLeases />} />
        <Card>
          <EmptyBlock
            icon="FolderHouse"
            title="No vacant unit to let"
            description="Every unit has a lease or is off market. Add a unit, or end a lease first."
            action={
              <ActionLink href={`${screenHref("Units")}?add=1`} icon="Plus" intent="primary">
                Add unit
              </ActionLink>
            }
          />
        </Card>
      </PageContent>
    );
  }

  const id: StepId = STEPS[step].id;
  const tErrors = tenantErrors(errors);
  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader eyebrow={<BackToLeases />} title="New lease" />
      <FlowStepper label="New lease steps" steps={[...STEPS]} current={step} onStepChange={goTo} />

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title={
            id === "unit"
              ? "Which unit?"
              : id === "tenant"
                ? "Who is the tenant?"
                : id === "terms"
                  ? "The terms"
                  : id === "people"
                    ? "Who lives there"
                    : "Read it through"
          }
          description={
            id === "unit"
              ? "Vacant units you can let."
              : id === "tenant"
                ? "Someone already on your books, or someone new."
                : id === "terms"
                  ? "Only days the rules allow can be picked."
                  : id === "people"
                    ? "The tenant signs for everyone named here."
                    : "This is the contract as it will be written. You sign it next."
          }
          footer={
            <>
              {step > 0 ? (
                <ActionButton icon="ArrowLeft" intent="ghost" onPress={() => goTo(step - 1)} isDisabled={pending}>
                  Back
                </ActionButton>
              ) : (
                <span />
              )}
              {id === "review" ? (
                <ActionButton icon="FileCheck" intent="primary" onPress={create} isPending={pending}>
                  Create lease
                </ActionButton>
              ) : (
                <ActionButton icon="ArrowRight" iconPlacement="end" intent="primary" onPress={next}>
                  Continue
                </ActionButton>
              )}
            </>
          }
        >
          {formError ? (
            <Alert status="danger">
              <Alert.Indicator>
                <Icon name="CircleExclamation" />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{formError}</Alert.Title>
              </Alert.Content>
            </Alert>
          ) : null}

          {id === "unit" ? (
            <div className="flex flex-col gap-2">
              <RadioButtonGroup
                aria-label="Unit"
                layout="grid"
                value={unitId ?? ""}
                onChange={pickUnit}
                className="grid-cols-1 gap-2.5 sm:grid-cols-2"
              >
                {units.map((u) => (
                  <RadioButtonGroup.Item key={u.id} value={u.id} className="gap-1 px-3.5 py-3">
                    <RadioButtonGroup.Indicator>
                      <Icon name="CircleCheckFill" />
                    </RadioButtonGroup.Indicator>
                    <RadioButtonGroup.ItemContent>
                      <Label className="font-semibold">Unit {u.label}</Label>
                      <Description className="text-xs">
                        {unitWords(u) || (properties.length > 1 ? u.propertyName : "No asking rent set")}
                      </Description>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>
              {errors.unitId ? <p className="text-xs text-danger">{errors.unitId}</p> : null}
            </div>
          ) : null}

          {id === "tenant" ? (
            <div className="flex flex-col gap-4">
              <Segment
                aria-label="Tenant"
                selectedKey={who}
                onSelectionChange={(k) => {
                  setWho(k === "existing" ? "existing" : "new");
                  setErrors({});
                  setFormError(null);
                }}
                className="w-fit"
              >
                <Segment.Item id="new">Someone new</Segment.Item>
                <Segment.Item id="existing">Someone you know</Segment.Item>
              </Segment>
              {who === "new" ? (
                <TenantFields tenant={tenant} onChange={setTenant} errors={tErrors} />
              ) : (
                <div className="flex flex-col gap-3">
                  <SearchBar
                    label="Find a tenant"
                    value={lookFor}
                    onChange={onLookFor}
                    placeholder="Name or email"
                    className="sm:w-full"
                  />
                  {known === null ? (
                    <p className="text-sm text-muted">Looking up your tenants…</p>
                  ) : known.length === 0 ? (
                    <EmptyBlock
                      size="sm"
                      icon="Persons"
                      title={lookFor ? "Nobody matches" : "No tenants yet"}
                      description="Add them as someone new."
                      action={
                        <ActionButton icon="PersonPlus" onPress={() => setWho("new")}>
                          Someone new
                        </ActionButton>
                      }
                    />
                  ) : (
                    <RadioButtonGroup
                      aria-label="Tenant"
                      layout="grid"
                      value={tenantId ?? ""}
                      onChange={(v) => {
                        setTenantId(v);
                        setErrors({});
                      }}
                      className="grid-cols-1 gap-2.5 sm:grid-cols-2"
                    >
                      {known.map((t) => (
                        <RadioButtonGroup.Item key={t.id} value={t.id} className="gap-1 px-3.5 py-3">
                          <RadioButtonGroup.Indicator>
                            <Icon name="CircleCheckFill" />
                          </RadioButtonGroup.Indicator>
                          <RadioButtonGroup.ItemContent>
                            <Label className="font-semibold">{t.fullName}</Label>
                            <Description className="text-xs">
                              {[
                                t.email ?? "No email",
                                t.leases[0] ? `${t.leases[0].reference} on ${t.leases[0].unitLabel}` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </Description>
                          </RadioButtonGroup.ItemContent>
                        </RadioButtonGroup.Item>
                      ))}
                    </RadioButtonGroup>
                  )}
                  {errors.tenantId ? <p className="text-xs text-danger">{errors.tenantId}</p> : null}
                  {chosen && (!chosen.email || !chosen.phone || !chosen.idNumber) ? (
                    <Alert status="warning">
                      <Alert.Indicator>
                        <Icon name="TriangleExclamation" />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title className="text-sm">
                          Their record is missing details the contract needs. Add them from the lease before you sign.
                        </Alert.Title>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {id === "tenant" ? (
            <section aria-label="Broker" className="flex flex-col gap-3 border-t border-separator pt-4">
              <BrokerPicker
                value={broker}
                onChange={setBroker}
                unitId={unitId}
                unitFee={unit?.brokerFee ?? profile.brokerFee}
                rentRwf={terms.monthlyRentRwf ?? unit?.askingRentRwf ?? null}
                errors={errors}
              />
            </section>
          ) : null}

          {id === "terms" ? (
            <TermsFields
              terms={terms}
              onChange={(t) => {
                if (t.monthlyRentRwf !== terms.monthlyRentRwf || t.depositRwf !== terms.depositRwf)
                  termsTouched.current = true;
                setTerms(t);
              }}
              errors={errors}
              today={today}
              autoStart={profile.leaseDefaults.autoStartLeases}
              isNew
            />
          ) : null}

          {id === "people" ? <OccupantsFields terms={terms} onChange={setTerms} errors={errors} /> : null}

          {id === "review" ? (
            <div className="flex flex-col gap-4">
              {signatoryReady ? null : (
                <Alert status="warning">
                  <Alert.Indicator>
                    <Icon name="TriangleExclamation" />
                  </Alert.Indicator>
                  <Alert.Content className="gap-2">
                    <Alert.Title className="text-sm">
                      Say who signs leases for the business before you sign this one.
                    </Alert.Title>
                    <ActionLink href={settingsHref("signatory")} size="sm" icon="Gear" className="self-start">
                      Open signatory settings
                    </ActionLink>
                  </Alert.Content>
                </Alert>
              )}
              {preview ? (
                <div className="rounded-xl border border-separator p-4">
                  <ContractDocument contract={preview} draft />
                </div>
              ) : (
                <p className="text-sm text-muted">Pick the dates first.</p>
              )}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="This lease" className="lg:sticky lg:top-4">
          <KeyValueList
            items={[
              { label: "Unit", value: unit ? `Unit ${unit.label}` : <Muted>Not picked</Muted> },
              {
                label: "Tenant",
                value:
                  who === "existing" ? (
                    (chosen?.fullName ?? <Muted>Not picked</Muted>)
                  ) : tenant.fullName.trim() ? (
                    tenant.fullName.trim()
                  ) : (
                    <Muted>Not added</Muted>
                  ),
              },
              {
                label: "Term",
                value:
                  terms.startDate && terms.endDate ? (
                    <span className="tabular">
                      <DateText value={terms.startDate} /> to <DateText value={terms.endDate} />
                    </span>
                  ) : (
                    <Muted>Not set</Muted>
                  ),
              },
              {
                label: "Rent",
                value: terms.monthlyRentRwf ? <Money value={terms.monthlyRentRwf} /> : <Muted>Not set</Muted>,
              },
              {
                label: "Deposit",
                value: terms.depositRwf !== null ? <Money value={terms.depositRwf} /> : <Muted>Not set</Muted>,
              },
              ...(broker.on && broker.broker ? [{ label: "Broker", value: broker.broker.name ?? "A broker" }] : []),
              ...(terms.occupants.filter((o) => o.trim()).length > 0
                ? [{ label: "Also living there", value: terms.occupants.filter((o) => o.trim()).join(", ") }]
                : []),
            ]}
          />
        </SectionCard>
      </div>
    </PageContent>
  );
}

function Muted({ children }: { children: string }) {
  return <span className="font-normal text-muted">{children}</span>;
}

function BackToLeases() {
  return (
    <ActionLink href={screenHref("Leases")} icon="ArrowLeft" intent="ghost" size="sm" className="-ml-3">
      Leases
    </ActionLink>
  );
}
