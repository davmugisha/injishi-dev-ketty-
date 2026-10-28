"use client";

import type { LeaseContract } from "@injishi/contracts";
import { formatDay } from "@injishi/ui";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function Party({ title, lines }: { title: string; lines: (string | null | undefined)[] }) {
  const shown = lines.filter((l): l is string => Boolean(l?.trim()));
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-separator p-3">
      <span className="text-xs text-muted">{title}</span>
      {shown.map((l, i) => (
        <span
          key={`${i}-${l}`}
          className={cx("min-w-0 break-words text-sm", i === 0 ? "font-semibold text-foreground" : "text-muted")}
        >
          {l}
        </span>
      ))}
    </div>
  );
}

/**
 * The lease as a document, the same wherever it is read (the landlord's record, the signing panel, the
 * tenant's Lease page): the two parties, the home, then the numbered clauses as they were frozen. With
 * `columns`, the clauses flow in two columns on a wide screen.
 */
export function ContractDocument({
  contract,
  columns = false,
  draft = false,
  hideParties = false,
  className,
}: {
  contract: LeaseContract;
  columns?: boolean;
  /** Not frozen yet: says so instead of an issue date. */
  draft?: boolean;
  /** The parties are shown elsewhere on the page. */
  hideParties?: boolean;
  className?: string;
}) {
  return (
    <article className={cx("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-lg font-semibold text-foreground">{contract.title}</h3>
        <p className="text-xs text-muted">
          {draft ? "Draft. The text is fixed when you sign it." : `Issued ${formatDay(contract.issuedAt, "long")}`}
        </p>
      </div>
      {hideParties ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Party
            title="Landlord"
            lines={[
              contract.parties.landlord.legalName,
              `Signed by ${contract.parties.landlord.signatoryName}`,
              `ID or TIN ${contract.parties.landlord.idNumber}`,
              contract.parties.landlord.phone,
              contract.parties.landlord.email,
            ]}
          />
          <Party
            title="Tenant"
            lines={[
              contract.parties.tenant.fullName,
              `${contract.parties.tenant.idKind === "national_id" ? "National ID" : "Passport"} ${contract.parties.tenant.idNumber}`,
              contract.parties.tenant.phone,
              contract.parties.tenant.email,
            ]}
          />
        </div>
      )}
      <div className="flex flex-col gap-0.5 rounded-xl bg-surface-secondary p-3">
        <span className="text-xs text-muted">The home</span>
        <span className="text-sm text-foreground">{contract.premisesLine}</span>
      </div>
      <ol className={cx("m-0 list-none p-0", columns ? "gap-8 xl:columns-2" : "flex flex-col gap-4")}>
        {contract.clauses.map((clause, i) => (
          <li key={clause.heading} className={cx("flex gap-3", columns && "mb-4 break-inside-avoid last:mb-0")}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-default text-xs font-semibold text-muted tabular">
              {i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold text-foreground">{clause.heading}</p>
              <p className="mt-1 text-sm leading-relaxed text-pretty text-muted">{clause.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
