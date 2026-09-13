"use client";

import type { District, GovernmentBody, OversightRole, OversightScopeLevel, Province } from "@injishi/contracts";
import { Button, Input, NativeDialog, Textarea } from "@injishi/ui";
import { Landmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { appointOfficer } from "@/lib/actions/oversight";
import { useAdminUi } from "@/lib/store";

/**
 * Appoint a person as a government officer (ADR-053, AC-G1, A1 and A2).
 *
 * This replaced the oversight half of the directory's grant editor, which listed
 * three hardcoded bodies and six districts and ended in "isn't built yet". The
 * choices here are the platform's: the LIVE bodies from the catalogue (a retired
 * one is not offered, because the platform refuses it for a new appointment), and
 * the provinces and districts from geography.
 *
 * **The platform's refusal stays in the dialog.** An appointment overlapping the
 * opposing role in the same region, or one inside a business the person works
 * for, is refused with a sentence that says which. It is shown here beside the
 * choices that caused it, and nothing typed is lost, so the staffer can change the
 * region or cancel. Every other outcome closes the dialog and toasts.
 *
 * Selects are native on purpose: a dozen options, keyboard and screen reader
 * behaviour for free, and nothing a listbox would add.
 */

const FUNCTIONS: { key: OversightRole; label: string }[] = [
  { key: "business_field_verifier", label: "Business field verifier — checks a business on site" },
  { key: "business_approver", label: "Business approver — approves a field-verified business" },
  { key: "tax_compliance_officer", label: "Tax compliance officer — reviews tax data" },
];

const SCOPES: { key: OversightScopeLevel; label: string }[] = [
  { key: "district", label: "District" },
  { key: "province", label: "Province" },
  { key: "country", label: "Country — all of Rwanda" },
];

const selectClass =
  "mt-1 h-10 w-full rounded border border-border bg-field px-2 text-sm text-foreground";

export function AppointOfficerDialog({
  person,
  bodies,
  provinces,
  districts,
  onClose,
}: {
  person: { id: string; name: string } | null;
  bodies: GovernmentBody[];
  provinces: Province[];
  districts: District[];
  onClose: () => void;
}) {
  const toast = useAdminUi((s) => s.toast);
  const router = useRouter();
  const live = bodies.filter((b) => b.active);
  const [role, setRole] = useState<OversightRole>("business_field_verifier");
  const [bodyCode, setBodyCode] = useState(live[0]?.code ?? "");
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<OversightScopeLevel>("district");
  const [provinceId, setProvinceId] = useState<number | null>(provinces[0]?.id ?? null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const inProvince = districts.filter((d) => d.provinceId === provinceId);

  const close = () => {
    if (pending) return;
    setRefusal(null);
    onClose();
  };

  return (
    <NativeDialog
      open={person !== null}
      dismissible={!pending}
      onClose={close}
      ariaLabel="Appoint a government officer"
      className="max-w-narrow"
    >
      <form
        className="p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!person) return;
          const form = e.currentTarget;
          const reason = String(new FormData(form).get("reason") ?? "");
          if (scope === "district" && districtId === null) {
            setRefusal("Choose the district this officer covers.");
            return;
          }
          setRefusal(null);
          setPending(true);
          try {
            const out = await appointOfficer(
              person.id,
              { oversightRole: role, governmentBodyCode: bodyCode, governmentTitle: title, scopeLevel: scope, provinceId, districtId },
              reason,
            );
            if (out.ok) {
              toast(`${person.name}: ${out.message}`, out.tone);
              form.reset();
              setTitle("");
              onClose();
              router.refresh();
            } else if (out.reason === "conflict" || out.reason === "rejected" || out.reason === "bad_input") {
              setRefusal(out.message);
            } else {
              toast(`${person.name}: ${out.message}`, out.tone);
              onClose();
            }
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
          <Landmark className="size-5 shrink-0" aria-hidden />
          Appoint an officer{person ? ` — ${person.name}` : ""}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The appointment opens their oversight console for the region chosen. It is refused if
          they already hold the opposing role there, or work for a business inside it.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">
            Function
            <select aria-label="Function" value={role} onChange={(e) => setRole(e.target.value as OversightRole)} className={selectClass}>
              {FUNCTIONS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            Government body
            <select aria-label="Government body" value={bodyCode} onChange={(e) => setBodyCode(e.target.value)} className={selectClass}>
              {live.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} — {b.nameEn}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            Government title
            <Input
              aria-label="Government title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The title their institution uses, e.g. BDO"
              className="mt-1 w-full"
              required
              minLength={2}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-semibold">
              Scope
              <select aria-label="Scope" value={scope} onChange={(e) => setScope(e.target.value as OversightScopeLevel)} className={selectClass}>
                {SCOPES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            {scope !== "country" && (
              <label className="block text-sm font-semibold">
                Province
                <select
                  aria-label="Province"
                  value={provinceId ?? ""}
                  onChange={(e) => {
                    setProvinceId(e.target.value ? Number(e.target.value) : null);
                    setDistrictId(null);
                  }}
                  className={selectClass}
                >
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {scope === "district" && (
              <label className="block text-sm font-semibold">
                District
                <select
                  aria-label="District"
                  value={districtId ?? ""}
                  onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : null)}
                  className={selectClass}
                >
                  <option value="">Choose…</option>
                  {inProvince.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <label className="block">
            <span className="text-sm font-semibold">Reason — recorded on the audit trail with your name</span>
            <Textarea
              name="reason"
              required
              minLength={4}
              maxLength={500}
              rows={3}
              className="mt-1"
              readOnly={pending}
              placeholder="Who asked for this appointment, and on what authority"
            />
          </label>
        </div>

        {refusal && (
          <p role="alert" className="mt-4 rounded-card border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
            {refusal}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <Button type="submit" variant="primary" className="grow" pending={pending}>
            {pending ? "Appointing…" : "Appoint"}
          </Button>
          <Button variant="outline" className="grow" disabled={pending} onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    </NativeDialog>
  );
}
