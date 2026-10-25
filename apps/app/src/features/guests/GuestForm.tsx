"use client";

import { Description, FieldError, Input, Label, TextField } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import {
  addDays,
  type GuestBuilding,
  type GuestRelationship,
  guestStayProblem,
  type HostGuest,
  LandlordGuestRequest,
  MAX_GUEST_STAY_DAYS,
  RWANDA_CODE,
  TenantGuestRequest,
} from "@injishi/contracts";
import {
  BoundedDatePicker,
  CountrySelect,
  isPlaceComplete,
  PhoneInput,
  type PlaceChain,
  PlacePicker,
  SelectField,
  SidePanel,
} from "@injishi/ui";
import { useState, useTransition } from "react";
import { loadGuestPlaces } from "./places";

type IdKind = "national_id" | "passport";
type Request = TenantGuestRequest | LandlordGuestRequest;

export type GuestSaveResult = { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export interface GuestFormProps {
  /** Who a guest can be to the host, in the form's order (`GET /reference/guest-relationships`). */
  relationships: readonly GuestRelationship[];
  /** The Kigali day today, from the server. */
  today: string;
  /** The days a stay may fall in: the lease's for a tenant's guest; none for a landlord's. */
  window?: { start?: string | null; end?: string | null };
  /** A landlord's buildings: the form asks which one (and which unit) the guest stays in. */
  buildings?: readonly GuestBuilding[];
  /** Editing a registration before arrival. */
  initial?: HostGuest | null;
  /** Saves the request (a server action calling the API); field errors come back in words. */
  onSave: (request: Request) => Promise<GuestSaveResult>;
  onClose: () => void;
}

const later = (a: string, b: string | null | undefined): string => (b && b > a ? b : a);
const sooner = (a: string, b: string | null | undefined): string => (b && b < a ? b : a);

/**
 * Register a guest staying overnight (P5): who they are, how to reach them, their nationality and, if the
 * host has it, their national ID or passport; who they are to the host; where they come from (a village
 * in Rwanda down the place cascade, or another country); and the days they stay (from today, inside the
 * lease for a tenant, at most 90 days). The same rules as the API (contracts' `TenantGuestRequest`,
 * `LandlordGuestRequest`, `guestStayProblem`); the API checks them again. The tenant's and the landlord's
 * guest screens open it in a side panel.
 */
export function GuestFormPanel({
  relationships,
  today,
  window = {},
  buildings,
  initial,
  onSave,
  onClose,
}: GuestFormProps) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [phone, setPhone] = useState<string | null>(initial?.phone ?? null);
  const [nationality, setNationality] = useState<string | null>(initial?.nationality ?? RWANDA_CODE);
  const [idKind, setIdKind] = useState<IdKind>(
    initial?.idKind ?? (initial?.nationality && initial.nationality !== RWANDA_CODE ? "passport" : "national_id"),
  );
  const [idNumber, setIdNumber] = useState(initial?.idNumber ?? "");
  const [relationship, setRelationship] = useState<string | null>(initial?.relationship ?? null);
  const [relationshipOther, setRelationshipOther] = useState(initial?.relationshipOther ?? "");
  const [from, setFrom] = useState<"village" | "country">(initial?.origin.kind ?? "village");
  const [originChain, setOriginChain] = useState<PlaceChain>({});
  const [originCountry, setOriginCountry] = useState<string | null>(
    initial?.origin.kind === "country" ? initial.origin.countryCode : null,
  );
  const [arrivalOn, setArrivalOn] = useState<string | null>(initial?.arrivalOn ?? null);
  const [departureOn, setDepartureOn] = useState<string | null>(initial?.departureOn ?? null);
  const [propertyId, setPropertyId] = useState<string | null>(
    initial?.propertyId ?? (buildings?.length === 1 ? (buildings[0]?.id ?? null) : null),
  );
  const [unitId, setUnitId] = useState<string | null>(initial?.unitId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Editing a field takes its error away; Register checks everything again.
  const clear = (field: string): void => setErrors((e) => (e[field] ? { ...e, [field]: "" } : e));

  const abroad = (nationality ?? RWANDA_CODE) !== RWANDA_CODE;
  const needsDetail = relationships.find((r) => r.code === relationship)?.needsDetail ?? false;
  const arrivalMin = later(today, window.start);
  const arrivalMax = window.end ?? null;
  const departureMin = arrivalOn ?? arrivalMin;
  const departureMax = sooner(addDays(departureMin, MAX_GUEST_STAY_DAYS), window.end);
  const building = buildings?.find((b) => b.id === propertyId) ?? null;
  // Editing keeps the village picked before unless it is changed (the cascade starts empty).
  const keptVillage =
    initial?.origin.kind === "village" && Object.keys(originChain).length === 0 ? initial.origin.villageId : null;

  const request = (): Record<string, unknown> => ({
    fullName,
    phone: phone ?? "",
    nationality: nationality ?? "",
    idKind: idNumber.trim() ? (abroad ? "passport" : idKind) : null,
    idNumber: idNumber.trim() || null,
    relationship: relationship ?? "",
    relationshipOther: needsDetail ? relationshipOther : null,
    origin:
      from === "village"
        ? { kind: "village", villageId: originChain.village ? Number(originChain.village.id) : (keptVillage ?? 0) }
        : { kind: "country", countryCode: originCountry ?? "" },
    arrivalOn: arrivalOn ?? "",
    departureOn: departureOn ?? "",
    ...(buildings ? { propertyId: propertyId ?? "", unitId: unitId || null } : {}),
  });

  const save = () => {
    const input = request();
    const schema = buildings ? LandlordGuestRequest : TenantGuestRequest;
    const parsed = schema.safeParse(input);
    const next: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "_");
        if (!next[key]) next[key] = issue.message;
      }
    }
    if (from === "village" && !keptVillage && !isPlaceComplete(originChain, "village")) {
      next.origin = "Choose every level, down to the village they come from.";
    }
    if (arrivalOn && departureOn) {
      const stay = guestStayProblem({ arrivalOn, departureOn, today, window });
      if (stay && !next[stay.path]) next[stay.path] = stay.message;
    }
    setErrors(next);
    setFormError(next._ ?? null);
    if (Object.keys(next).length > 0 || !parsed.success) return;
    start(async () => {
      const result = await onSave(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors && Object.keys(result.fieldErrors).length > 0 ? null : result.error);
        return;
      }
      onClose();
    });
  };

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={initial ? `Change ${initial.fullName}` : "Register a guest"}
      description="Shared with the local leaders of the area. The landlord does not see a tenant's guests."
      submitLabel={initial ? "Save changes" : "Register guest"}
      submitIcon="PersonPlus"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {buildings ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Building"
            name="propertyId"
            value={propertyId}
            options={buildings.map((b) => ({
              id: b.id,
              label: b.name,
              description: b.located ? (b.address ?? undefined) : "No village on record yet",
            }))}
            onChange={(v) => {
              setPropertyId(v);
              setUnitId(null);
            }}
            description={
              building && !building.located
                ? "Guests here reach the village leader once the building's village is set."
                : undefined
            }
            errorMessage={errors.propertyId}
          />
          {building && building.units.length > 0 ? (
            <SelectField
              label="Unit"
              name="unitId"
              value={unitId ?? ""}
              placeholder="No unit, the building"
              options={[
                { id: "", label: "No unit, the building" },
                ...building.units.map((u) => ({ id: u.id, label: u.label })),
              ]}
              onChange={(v) => setUnitId(v || null)}
              errorMessage={errors.unitId}
            />
          ) : null}
        </div>
      ) : null}

      <TextField
        name="fullName"
        value={fullName}
        onChange={(v) => {
          setFullName(v);
          clear("fullName");
        }}
        isRequired
        isInvalid={errors.fullName ? true : undefined}
        fullWidth
        className="gap-1"
      >
        <Label>Full name</Label>
        <Input placeholder="As on their ID" autoComplete="off" />
        <FieldError>{errors.fullName}</FieldError>
      </TextField>

      <div className="grid gap-3 sm:grid-cols-2">
        <PhoneInput
          label="Phone"
          name="phone"
          value={phone}
          onChange={(e164) => {
            setPhone(e164);
            clear("phone");
          }}
          allowInternational
          isRequired
          description="A Rwandan number, or one with its + country code"
          errorMessage={errors.phone || null}
        />
        <CountrySelect
          label="Nationality"
          name="nationality"
          value={nationality}
          onChange={(code) => {
            setNationality(code);
            clear("nationality");
            if (code && code !== RWANDA_CODE) setIdKind("passport");
          }}
          isRequired
          errorMessage={errors.nationality || null}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">ID document</span>
        {abroad ? null : (
          <Segment
            aria-label="ID document"
            selectedKey={idKind}
            onSelectionChange={(k) => setIdKind(k as IdKind)}
            className="w-fit"
          >
            <Segment.Item id="national_id">National ID</Segment.Item>
            <Segment.Item id="passport">Passport</Segment.Item>
          </Segment>
        )}
        <TextField
          name="idNumber"
          aria-label={abroad || idKind === "passport" ? "Passport number" : "National ID number"}
          value={idNumber}
          onChange={(v) => {
            setIdNumber(v);
            clear("idNumber");
            clear("idKind");
          }}
          isInvalid={errors.idNumber || errors.idKind ? true : undefined}
          fullWidth
          className="gap-1"
        >
          <Input
            placeholder={abroad || idKind === "passport" ? "Passport number" : "16 digits"}
            inputMode={!abroad && idKind === "national_id" ? "numeric" : "text"}
            autoComplete="off"
          />
          <Description>Optional. Add it if you have it.</Description>
          <FieldError>{errors.idNumber ?? errors.idKind}</FieldError>
        </TextField>
      </div>

      <SelectField
        label="Who they are to you"
        name="relationship"
        value={relationship}
        options={relationships.map((r) => ({ id: r.code, label: r.label }))}
        onChange={(v) => {
          setRelationship(v);
          clear("relationship");
        }}
        isRequired
        errorMessage={errors.relationship || null}
      />
      {needsDetail ? (
        <TextField
          name="relationshipOther"
          value={relationshipOther}
          onChange={(v) => {
            setRelationshipOther(v);
            clear("relationshipOther");
          }}
          isInvalid={errors.relationshipOther ? true : undefined}
          fullWidth
          className="gap-1"
        >
          <Label>In a few words</Label>
          <Input placeholder="A friend from church, my landlord's driver, ..." />
          <FieldError>{errors.relationshipOther}</FieldError>
        </TextField>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Coming from</span>
        <Segment
          aria-label="Coming from"
          selectedKey={from}
          onSelectionChange={(k) => {
            setFrom(k as "village" | "country");
            setErrors((e) => ({ ...e, origin: "" }));
          }}
          className="w-fit"
        >
          <Segment.Item id="village">Somewhere in Rwanda</Segment.Item>
          <Segment.Item id="country">Another country</Segment.Item>
        </Segment>
        {from === "village" ? (
          <PlacePicker
            label={keptVillage ? "Village (leave empty to keep the one chosen)" : undefined}
            value={originChain}
            onChange={(c) => {
              setOriginChain(c);
              clear("origin");
            }}
            loadPlaces={loadGuestPlaces}
            reserveSpace={false}
            errorMessage={errors.origin || null}
          />
        ) : (
          <CountrySelect
            label="Country"
            value={originCountry}
            onChange={(c) => {
              setOriginCountry(c);
              clear("origin");
            }}
            pinned={["UG", "KE", "TZ", "BI", "CD"]}
            errorMessage={errors.origin || null}
          />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <BoundedDatePicker
          label="Arrives"
          name="arrivalOn"
          value={arrivalOn}
          onChange={(d) => {
            setArrivalOn(d);
            clear("arrivalOn");
            if (
              d &&
              departureOn &&
              (departureOn < d || departureOn > sooner(addDays(d, MAX_GUEST_STAY_DAYS), window.end))
            )
              setDepartureOn(null);
          }}
          minValue={arrivalMin}
          maxValue={arrivalMax}
          isRequired
          description={window.end ? "From today, inside your lease" : "From today"}
          errorMessage={errors.arrivalOn || null}
        />
        <BoundedDatePicker
          label="Leaves"
          name="departureOn"
          value={departureOn}
          onChange={(d) => {
            setDepartureOn(d);
            clear("departureOn");
          }}
          minValue={departureMin}
          maxValue={departureMax}
          isRequired
          description={`At most ${MAX_GUEST_STAY_DAYS} days`}
          errorMessage={errors.departureOn || null}
        />
      </div>
    </SidePanel>
  );
}
