"use client";

import type {
  AdminTrainingVenue,
  District,
  Province,
} from "@injishi/contracts";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  NativeDialog,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@injishi/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createVenue, editVenue, retireVenue } from "@/lib/actions/training";
import { useAdminUi } from "@/lib/store";

import { formatKigali } from "../kigali-time";
import { OutcomeNotice, type Notice } from "../outcome-notice";

/**
 * The venue list and its three writes (ADR-049 AC-32).
 *
 * `canManage` is `training.venue.manage`, resolved on the server from the
 * caller's own `StaffAccess.permissions`. Without it the list is read-only:
 * no add button, no edit, no retire. That is the affordance only; the API
 * refuses the write on its own.
 *
 * ONE FORM, TWO USES. Adding and editing a venue ask the same four questions,
 * so the form is one component opened either empty or holding a row. A
 * retired venue offers neither edit nor retire: retiring is one way, and the
 * API answers 409 to an edit of one, which a stale page can still reach and
 * which then reads in the API's own words.
 */
export function VenueDirectory({
  venues,
  total,
  includeRetired,
  districts,
  provinces,
  canManage,
}: {
  venues: AdminTrainingVenue[];
  total: number;
  includeRetired: boolean;
  /** `null` when the geography read failed: the form cannot be offered. */
  districts: District[] | null;
  provinces: Province[];
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useAdminUi((state) => state.toast);
  const [form, setForm] = useState<"closed" | "new" | AdminTrainingVenue>("closed");
  const [retiring, setRetiring] = useState<AdminTrainingVenue | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();

  const active = venues.filter((venue) => venue.retiredAt === null).length;
  const counts = `${venues.length.toLocaleString("en-RW")} loaded, ${active.toLocaleString(
    "en-RW",
  )} in use${total > venues.length ? `, ${total.toLocaleString("en-RW")} in total` : ""}`;

  function report(message: string, tone: Notice["tone"]) {
    setNotice({ message, tone });
    toast(message, tone);
  }

  function retire(venue: AdminTrainingVenue) {
    startTransition(async () => {
      const out = await retireVenue(venue.id);
      report(out.message, out.tone);
      setRetiring(null);
      if (out.ok) router.refresh();
    });
  }

  return (
    <section className="mt-6" aria-label="Training venues">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant={includeRetired ? "outline" : "primary"}>
            <Link href="/training/venues" aria-current={includeRetired ? undefined : "true"}>
              In use
            </Link>
          </Button>
          <Button asChild size="sm" variant={includeRetired ? "primary" : "outline"}>
            <Link href="/training/venues?retired=1" aria-current={includeRetired ? "true" : undefined}>
              Include retired
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">{counts}</p>
        </div>
        {canManage && form === "closed" ? (
          <Button size="sm" onClick={() => setForm("new")} disabled={districts === null}>
            Add a venue
          </Button>
        ) : null}
      </div>

      {canManage && districts === null ? (
        <p className="mt-3 text-sm text-muted-foreground">
          The district list couldn&apos;t be read, so a venue can&apos;t be added or
          edited right now. The list below is still accurate.
        </p>
      ) : null}

      <OutcomeNotice notice={notice} />

      {canManage && districts !== null && form !== "closed" ? (
        <VenueForm
          key={form === "new" ? "new" : form.id}
          venue={form === "new" ? null : form}
          districts={districts}
          provinces={provinces}
          onCancel={() => setForm("closed")}
          onDone={(message, tone, ok) => {
            report(message, tone);
            if (ok) {
              setForm("closed");
              router.refresh();
            }
          }}
        />
      ) : null}

      {venues.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {includeRetired
            ? "No venue has ever been added."
            : "No venue is in use. A session can't be drafted until one is added."}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Venue</Th>
                <Th>District</Th>
                <Th>Standing</Th>
                {canManage ? <Th>Manage</Th> : null}
              </tr>
            </thead>
            <tbody>
              {venues.map((venue) => (
                <tr key={venue.id} className="border-b border-border" data-venue={venue.id}>
                  <Td>
                    <span className="font-medium">{venue.name}</span>
                    {venue.isOffice ? (
                      <Badge variant="subtle" className="ml-2">
                        Injishi office
                      </Badge>
                    ) : null}
                    <span className="block text-xs text-muted-foreground">
                      {venue.address}
                    </span>
                  </Td>
                  <Td>
                    {venue.districtName}
                    <span className="block text-xs text-muted-foreground">
                      {venue.provinceName}
                    </span>
                  </Td>
                  <Td>
                    {venue.retiredAt ? (
                      <>
                        <Badge variant="light">Retired</Badge>
                        <span className="block text-xs text-muted-foreground">
                          since {formatKigali(venue.retiredAt)}
                        </span>
                      </>
                    ) : (
                      <Badge variant="success">In use</Badge>
                    )}
                  </Td>
                  {canManage ? (
                    <Td>
                      {venue.retiredAt ? (
                        <span className="text-xs text-muted-foreground">
                          Retired venues are kept as they were
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setForm(venue)}
                            disabled={districts === null}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRetiring(venue)}
                          >
                            Retire
                          </Button>
                        </div>
                      )}
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NativeDialog
        open={retiring !== null}
        dismissible={!pending}
        onClose={() => {
          if (!pending) setRetiring(null);
        }}
        ariaLabel="Retire this venue"
      >
        {retiring ? (
          <div className="p-7">
            <h2 className="font-display text-2xl font-bold">
              Retire {retiring.name}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Retiring is one way. It leaves the session form&apos;s venue list
              at once, and any draft session there can no longer be published
              until it is moved. Sessions already published there still run,
              and certificates that name it keep its name.
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                variant="danger"
                className="grow"
                pending={pending}
                onClick={() => retire(retiring)}
              >
                {pending ? "Waiting for the platform…" : "Retire the venue"}
              </Button>
              <Button
                variant="outline"
                className="grow"
                disabled={pending}
                onClick={() => setRetiring(null)}
              >
                Keep it
              </Button>
            </div>
          </div>
        ) : null}
      </NativeDialog>
    </section>
  );
}

/**
 * Add or edit one venue.
 *
 * THE DISTRICT IS PICKED, never typed, from the geography reference data and
 * grouped under its province, because "Musanze" is only useful to somebody who
 * already knows it is in the North. Only the district id is sent: it carries
 * its province (D11), and sending both would let the form claim a district is
 * somewhere it is not.
 */
function VenueForm({
  venue,
  districts,
  provinces,
  onCancel,
  onDone,
}: {
  venue: AdminTrainingVenue | null;
  districts: District[];
  provinces: Province[];
  onCancel: () => void;
  onDone: (message: string, tone: Notice["tone"], ok: boolean) => void;
}) {
  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [districtId, setDistrictId] = useState(venue ? String(venue.districtId) : "");
  const [isOffice, setIsOffice] = useState(venue?.isOffice ?? false);
  const [pending, startTransition] = useTransition();

  const groups = groupByProvince(districts, provinces);
  const idPrefix = venue ? `venue-${venue.id}` : "venue-new";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const input = { name, address, districtId: Number(districtId), isOffice };
      const out = venue ? await editVenue(venue.id, input) : await createVenue(input);
      onDone(out.message, out.tone, out.ok);
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-label={venue ? `Edit ${venue.name}` : "Add a venue"}
      className="mt-4 rounded-card border border-border bg-field p-5"
    >
      <p className="text-sm font-semibold">
        {venue ? `Edit ${venue.name}` : "Add a venue"}
      </p>
      <p className="mt-1 max-w-read text-sm text-muted-foreground">
        {venue
          ? "Certificates already issued keep the venue name and district they were issued with."
          : "A trainer picks from this list when drafting a session; nobody types a venue."}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input
            id={`${idPrefix}-name`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-district`}>District</Label>
          <Select value={districtId} onValueChange={setDistrictId}>
            <SelectTrigger id={`${idPrefix}-district`} aria-label="District">
              <SelectValue placeholder="Pick a district" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.districts.map((district) => (
                    <SelectItem key={district.id} value={String(district.id)}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`${idPrefix}-address`}>Address</Label>
          <Input
            id={`${idPrefix}-address`}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            required
            minLength={2}
            maxLength={400}
          />
        </div>
        <div className="sm:col-span-2">
          <Checkbox isSelected={isOffice} onChange={setIsOffice}>
            <span className="text-sm">This is the Injishi office</span>
          </Checkbox>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" size="sm" pending={pending} disabled={districtId === ""}>
          {pending ? "Saving…" : venue ? "Save the venue" : "Add the venue"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Districts under their province's name, provinces and districts in name order. */
function groupByProvince(
  districts: District[],
  provinces: Province[],
): { label: string; districts: District[] }[] {
  const byProvince = new Map<number, District[]>();
  for (const district of districts) {
    const list = byProvince.get(district.provinceId) ?? [];
    list.push(district);
    byProvince.set(district.provinceId, list);
  }
  return [...byProvince.entries()]
    .map(([provinceId, list]) => ({
      label:
        provinces.find((province) => province.id === provinceId)?.name ??
        `Province ${provinceId}`,
      districts: list.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
}
