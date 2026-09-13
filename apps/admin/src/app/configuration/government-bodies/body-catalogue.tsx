"use client";

import type { GovernmentBody } from "@injishi/contracts";
import { Badge, Button, Input, NativeDialog, Textarea } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useStaffPermissions } from "@/components/shell/staff-access-provider";
import {
  createGovernmentBody,
  renameGovernmentBody,
  setGovernmentBodyActive,
} from "@/lib/actions/government-bodies";
import type { WriteOutcome } from "@/lib/actions/outcome";
import { useAdminUi } from "@/lib/store";

/**
 * The government body catalogue, with its writes for a staffer who may make
 * them (ADR-053, AC-G4).
 *
 * Every write asks why, like every console write, and a refusal the platform
 * explained (a duplicate code, say) stays in the dialog in its own words so the
 * staffer can correct it. A confirmed write re-reads the page, so the list shows
 * what the platform now holds.
 *
 * COLOCATED with its route, like `app/configuration/fees/fee-schedule.tsx`.
 */
export function BodyCatalogue({ bodies }: { bodies: GovernmentBody[] }) {
  const mayEdit = useStaffPermissions().includes("admin.config.edit");
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<GovernmentBody | null>(null);
  const [toggling, setToggling] = useState<GovernmentBody | null>(null);
  const sorted = [...bodies].sort((a, b) => Number(b.active) - Number(a.active) || a.code.localeCompare(b.code));

  return (
    <section aria-label="Government bodies">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {bodies.length} bodies · {bodies.filter((b) => b.active).length} taking appointments
        </h2>
        {mayEdit ? (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            Add a government body
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Read only: changing the catalogue needs the configuration edit permission.
          </p>
        )}
      </div>

      <div className="mt-3 scrollbar overflow-x-auto rounded-card border border-border bg-field">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">Government bodies officers are appointed from</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <th className="p-4">Code</th>
              <th className="p-4">Name</th>
              <th className="p-4">State</th>
              <th className="p-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((body) => (
              <tr key={body.code} data-body-code={body.code}>
                <td className="money p-4 font-semibold">{body.code}</td>
                <td className="p-4">
                  <span className="font-semibold">{body.nameEn}</span>
                  <span className="block text-xs text-muted-foreground">
                    {body.nameRw}
                    {body.abbreviation ? ` · ${body.abbreviation}` : ""}
                  </span>
                </td>
                <td className="p-4">
                  <Badge variant={body.active ? "success" : "default"}>{body.active ? "Taking appointments" : "Retired"}</Badge>
                </td>
                <td className="p-4 text-right">
                  {mayEdit && (
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setRenaming(body)}>
                        Rename…
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setToggling(body)}>
                        {body.active ? "Retire…" : "Restore…"}
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mayEdit && (
        <>
          <WriteDialog
            open={adding}
            onClose={() => setAdding(false)}
            title="Add a government body"
            confirmLabel="Add body"
            body="The code is permanent: capital letters, digits or underscores, as the institution is known."
            fields={(pending) => (
              <>
                <Field label="Code" name="code" pending={pending} placeholder="e.g. RDB" />
                <Field label="Name in English" name="nameEn" pending={pending} />
                <Field label="Name in Kinyarwanda" name="nameRw" pending={pending} />
                <Field label="Abbreviation (optional)" name="abbreviation" pending={pending} optional />
              </>
            )}
            onConfirm={(form) =>
              createGovernmentBody({
                code: form.get("code"),
                nameEn: form.get("nameEn"),
                nameRw: form.get("nameRw"),
                abbreviation: form.get("abbreviation"),
                reason: form.get("reason"),
              })
            }
          />
          <WriteDialog
            key={renaming?.code ?? "none"}
            open={renaming !== null}
            onClose={() => setRenaming(null)}
            title={`Rename ${renaming?.code ?? ""}`}
            confirmLabel="Rename"
            body="Officer consoles show the new name. Decisions already recorded keep the name they were taken under."
            fields={(pending) => (
              <>
                <Field label="Name in English" name="nameEn" pending={pending} defaultValue={renaming?.nameEn} />
                <Field label="Name in Kinyarwanda" name="nameRw" pending={pending} defaultValue={renaming?.nameRw} />
              </>
            )}
            onConfirm={(form) =>
              renameGovernmentBody(renaming?.code ?? "", {
                nameEn: form.get("nameEn"),
                nameRw: form.get("nameRw"),
                reason: form.get("reason"),
              })
            }
          />
          <WriteDialog
            open={toggling !== null}
            onClose={() => setToggling(null)}
            title={toggling?.active ? `Retire ${toggling.code}?` : `Restore ${toggling?.code ?? ""}?`}
            confirmLabel={toggling?.active ? "Retire body" : "Restore body"}
            body={
              toggling?.active
                ? "It stops being offered for a new appointment. Every appointment that names it keeps doing so."
                : "It can take new appointments again."
            }
            fields={() => null}
            onConfirm={(form) => setGovernmentBodyActive(toggling?.code ?? "", !toggling?.active, form.get("reason"))}
          />
        </>
      )}
    </section>
  );
}

/** The values a write dialog's form carries, always as strings. */
interface FormValues {
  get(name: string): string;
}

function WriteDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  fields,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  fields: (pending: boolean) => ReactNode;
  onConfirm: (form: FormValues) => Promise<WriteOutcome<GovernmentBody>>;
}) {
  const toast = useAdminUi((s) => s.toast);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const close = () => {
    if (pending) return;
    setRefusal(null);
    onClose();
  };

  return (
    <NativeDialog open={open} dismissible={!pending} onClose={close} ariaLabel={title} className="max-w-narrow">
      <form
        className="p-7"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          setRefusal(null);
          setPending(true);
          try {
            const out = await onConfirm({ get: (name) => String(data.get(name) ?? "") });
            if (out.ok) {
              toast(out.message, out.tone);
              form.reset();
              onClose();
              router.refresh();
            } else if (out.reason === "conflict" || out.reason === "rejected" || out.reason === "bad_input") {
              setRefusal(out.message);
            } else {
              toast(out.message, out.tone);
              onClose();
            }
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <div className="mt-2 text-sm text-muted-foreground">{body}</div>
        <div className="mt-4 space-y-3">
          {fields(pending)}
          <label className="block">
            <span className="text-sm font-semibold">Reason — recorded on the audit trail with your name</span>
            <Textarea name="reason" required minLength={4} maxLength={500} rows={3} className="mt-1" readOnly={pending} />
          </label>
        </div>
        {refusal && (
          <p role="alert" className="mt-4 rounded-card border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
            {refusal}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Button type="submit" variant="primary" className="grow" pending={pending}>
            {pending ? "Waiting for the platform…" : confirmLabel}
          </Button>
          <Button variant="outline" className="grow" disabled={pending} onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    </NativeDialog>
  );
}

function Field({
  label,
  name,
  pending,
  placeholder,
  defaultValue,
  optional = false,
}: {
  label: string;
  name: string;
  pending: boolean;
  placeholder?: string;
  defaultValue?: string;
  optional?: boolean;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <Input
        name={name}
        aria-label={label.replace(" (optional)", "")}
        required={!optional}
        readOnly={pending}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full"
      />
    </label>
  );
}
