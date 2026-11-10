import { PSF_STANDING_LABEL, type PsfBusinessDetail } from "@injishi/contracts";
import { ActionLink, EmptyBlock, LinkButton, formatDay, formatMoney, PageContent, PageHeader, SectionCard, StatusChip } from "@injishi/ui";
import { FactGrid } from "@/features/oversight/shared";
import { WEB_URL } from "@/lib/return-to";

const PAYMENT_LABEL: Record<PsfBusinessDetail["history"]["payments"][number]["kind"], string> = {
  registration_fee: "Registration fee",
  membership_fee: "Membership fee",
  membership_renewal: "Membership renewal",
};

/**
 * One business's PSF side for Injishi staff (2026-11-02): where its membership stands, every
 * renewal it paid, every membership it held, its applications and its payments. Read only.
 */
export function AdminPsfBusinessView({ detail }: { detail: PsfBusinessDetail }) {
  const b = detail.business;
  const { history, renewals } = detail;
  const docId = history.applications.find((x) => x.status === "member")?.docId ?? history.applications[0]?.docId ?? null;
  return (
    <PageContent>
      <ActionLink href="/admin/psf" size="sm" icon="ArrowLeft" className="self-start">
        PSF memberships
      </ActionLink>
      <PageHeader
        eyebrow={[b.businessCode, b.districtName].filter(Boolean).join(" · ") || "PSF"}
        title={b.legalName}
        description={[b.clusterName, b.subsectorName, b.associationName].filter(Boolean).join(" · ") || undefined}
        actions={
          <LinkButton href={`/admin/businesses/${b.orgId}`} variant="secondary">
            Business page
          </LinkButton>
        }
      />

      <SectionCard title="Membership" description="Where it stands with the Private Sector Federation">
        <FactGrid
          min={150}
          className="gap-x-4 gap-y-3"
          items={[
            { label: "Status", value: PSF_STANDING_LABEL[b.standing] ?? b.standing },
            { label: "Membership number", value: b.membershipNumber ?? "None yet" },
            {
              // The docID opens the business's tracking page: renewal and the certificate live there (2026-11-02).
              label: "docID",
              value: docId ? (
                <a href={`${WEB_URL}/psf/track/${docId}`} target="_blank" rel="noreferrer" className="font-mono font-semibold text-accent hover:underline">
                  {docId}
                </a>
              ) : (
                "None yet"
              ),
            },
            { label: "Tier", value: b.tierName ?? "—" },
            { label: "Valid until", value: b.standing === "member" && b.expiresOn ? formatDay(b.expiresOn) : b.standing === "lapsed" ? "Lapsed" : "—" },
            { label: "Paid to PSF", value: formatMoney(b.paidRwf) },
            { label: "Last paid", value: b.lastPaidAt ? formatDay(b.lastPaidAt) : "—" },
          ]}
        />
      </SectionCard>

      <SectionCard title="Renewals" description="Paid by the business on its tracking page; renewed at once, with no decision">
        {renewals.length ? (
          <ul className="flex flex-col divide-y divide-separator">
            {renewals.map((r) => (
              <li key={`${r.paidAt}-${r.startsOn}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="min-w-0 flex-1 font-medium">
                  {formatDay(r.startsOn)} to {formatDay(r.expiresOn)}
                </span>
                <span className="text-muted">{r.tierName}</span>
                <span className="tabular">{formatMoney(r.amountRwf)}</span>
                <span className="text-xs text-muted">paid {formatDay(r.paidAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyBlock size="sm" icon="ArrowsRotateRight" title="No renewal yet" description="It renews from 60 days before its end date." />
        )}
      </SectionCard>

      <SectionCard title="Memberships held" description="A lapsed membership renewed later starts a new period under the same number">
        {history.memberships.length ? (
          <ul className="flex flex-col divide-y divide-separator">
            {history.memberships.map((m) => (
              <li key={`${m.number}-${m.startsOn}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="min-w-0 flex-1 font-medium">{m.number}</span>
                <span className="text-muted">{m.tierName ?? "—"}</span>
                <span className="tabular">
                  {m.startsOn ? formatDay(m.startsOn) : "—"} to {m.expiresOn ? formatDay(m.expiresOn) : "—"}
                </span>
                <StatusChip tone={m.current ? "success" : "default"}>{m.current ? "Current" : "Ended"}</StatusChip>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyBlock size="sm" icon="Persons" title="Never a member" />
        )}
      </SectionCard>

      <SectionCard title="Applications and payments">
        <ul className="flex flex-col divide-y divide-separator">
          {history.applications.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                {a.tierName} · applied {formatDay(a.submittedAt)}
                {a.docId ? <span className="text-muted"> · {a.docId}</span> : null}
              </span>
              <span className="text-xs text-muted">{a.declineReasonLabel ?? a.status}</span>
            </li>
          ))}
          {history.payments.map((p, i) => (
            <li key={`${p.kind}-${p.at ?? i}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
              <span className="min-w-0 flex-1">{PAYMENT_LABEL[p.kind]}</span>
              <span className="tabular">{formatMoney(p.amountRwf)}</span>
              <span className="text-xs text-muted">{p.at ? formatDay(p.at) : "—"}</span>
            </li>
          ))}
        </ul>
        {detail.contact ? (
          <p className="text-sm text-muted">
            Contact: {detail.contact.name} ({detail.contact.role}) · {detail.contact.phoneE164}
            {detail.contact.email ? ` · ${detail.contact.email}` : ""}
          </p>
        ) : null}
      </SectionCard>
    </PageContent>
  );
}
