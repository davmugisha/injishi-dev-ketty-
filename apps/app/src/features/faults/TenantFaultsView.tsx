"use client";

import { Alert, Toast, toast } from "@heroui/react";
import {
  FAULT_CATEGORY_LABEL,
  FAULT_REOPEN_DAYS,
  FAULT_URGENCY_LABEL,
  type TenancyDetail,
  type TenantFaultDetail,
  type TenantFaultItem,
} from "@injishi/contracts";
import {
  ActionButton,
  type DataColumn,
  DataTable,
  DateText,
  EmptyBlock,
  ErrorBlock,
  EventTimeline,
  FormDialog,
  Icon,
  KeyValueList,
  LoadingBlock,
  PageContent,
  PageHeader,
  PhotoGallery,
  SectionHeader,
  SidePanel,
  StatusChip,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { placeWords } from "../leases/shared";
import { TextInput } from "../rentals/fields";
import { loadTenantFault, reopenFault, reportFault, tenantReplyOnFault } from "./actions";
import { ReportFaultDialog } from "./ReportFaultDialog";
import { ageWords, faultTimeline } from "./shared";

/**
 * The tenant's faults (P4): every fault reported on their home with where it stands, Report a fault with
 * photos, and a side panel per fault with the timeline they may see, the photos, a reply to the landlord
 * and Reopen while the 14 days after a fix last.
 */
export function TenantFaultsView({
  tenancy,
  items,
  today,
  openId,
}: {
  tenancy: TenancyDetail;
  items: TenantFaultItem[];
  today: string;
  openId: string | null;
}) {
  const [reporting, setReporting] = useState(false);
  const [selected, setSelected] = useState<string | null>(openId);
  const live = tenancy.status === "active" || tenancy.status === "ending" || tenancy.status === "signed";

  const columns: DataColumn<TenantFaultItem>[] = [
    {
      id: "fault",
      header: "Fault",
      isRowHeader: true,
      sortValue: (f) => f.title,
      cell: (f) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{f.title}</span>
          <span className="truncate text-xs text-muted">
            {[f.reference, f.category ? FAULT_CATEGORY_LABEL[f.category] : null].filter(Boolean).join(" · ")}
          </span>
        </div>
      ),
    },
    {
      id: "who",
      header: "Fixing it",
      hideBelow: "lg",
      cell: (f) => f.assigneeName ?? <span className="text-muted">Nobody yet</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (f) => (
        <StatusChip kind="fault" status={f.status}>
          {f.statusWords}
        </StatusChip>
      ),
    },
    {
      id: "age",
      header: "Reported",
      align: "end",
      sortValue: (f) => f.reportedAt,
      cell: (f) => (
        <span className="whitespace-nowrap text-sm text-muted tabular">{ageWords(f.reportedAt, today)}</span>
      ),
    },
  ];

  const reportButton = live ? (
    <ActionButton icon="Plus" intent="primary" onPress={() => setReporting(true)}>
      Report a fault
    </ActionButton>
  ) : null;

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      {/* With nothing reported, the empty state carries the one Report button. */}
      <PageHeader eyebrow={placeWords(tenancy)} title="Faults" actions={items.length > 0 ? reportButton : null} />
      <DataTable
        label="Your faults"
        rows={items}
        rowKey={(f) => f.id}
        columns={columns}
        defaultSort={{ column: "age", direction: "descending" }}
        onRowAction={(f) => setSelected(f.id)}
        mobile={{
          title: (f) => f.title,
          description: (f) => [f.reference, ageWords(f.reportedAt, today)].filter(Boolean).join(" · "),
          trailing: (f) => (
            <StatusChip kind="fault" status={f.status}>
              {f.statusWords}
            </StatusChip>
          ),
        }}
        empty={
          <EmptyBlock
            icon="Wrench"
            title="Nothing reported"
            description="A leak, a broken lock, no power: report it with a photo."
            action={reportButton ?? undefined}
          />
        }
      />
      {reporting ? (
        <ReportFaultDialog
          title="Report a fault"
          description="Your landlord is told at once."
          create={async (draft) => {
            const r = await reportFault(tenancy.id, draft);
            return r.ok ? { ok: true, value: { id: r.value.id, reference: r.value.reference } } : r;
          }}
          photoRoute={(id) => `/api/tenancies/${tenancy.id}/faults/${id}/photos`}
          onClose={() => setReporting(false)}
          onSaved={(id) => {
            setReporting(false);
            setSelected(id);
          }}
        />
      ) : null}
      {selected ? (
        <TenantFaultPanel key={selected} leaseId={tenancy.id} faultId={selected} onClose={() => setSelected(null)} />
      ) : null}
    </PageContent>
  );
}

function TenantFaultPanel({ leaseId, faultId, onClose }: { leaseId: string; faultId: string; onClose: () => void }) {
  const router = useRouter();
  const [fault, setFault] = useState<TenantFaultDetail | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [sending, start] = useTransition();

  const load = useCallback(async () => {
    setFailed(null);
    const r = await loadTenantFault(leaseId, faultId);
    if (!r.ok) {
      setFailed(r.error);
      return;
    }
    setFault(r.value);
  }, [leaseId, faultId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = () =>
    start(async () => {
      if (!reply.trim()) {
        setReplyError("Write a message.");
        return;
      }
      const r = await tenantReplyOnFault(leaseId, faultId, { body: reply.trim() });
      if (!r.ok) {
        setReplyError(r.fieldErrors?.body ?? r.error);
        return;
      }
      setFault(r.value);
      setReply("");
      toast.success("Message sent to your landlord");
      router.refresh();
    });

  const open = fault && !["resolved", "closed", "wont_fix", "cancelled"].includes(fault.status);
  return (
    <>
      <SidePanel
        isOpen
        onOpenChange={(o) => (o ? undefined : onClose())}
        title={fault?.title ?? "Fault"}
        description={fault?.reference ?? undefined}
        headerExtra={
          fault ? (
            <StatusChip kind="fault" status={fault.status} size="md">
              {fault.statusWords}
            </StatusChip>
          ) : null
        }
        size="lg"
        footer={
          fault?.canReopen ? (
            <ActionButton icon="ArrowRotateLeft" onPress={() => setReopening(true)}>
              It's not fixed
            </ActionButton>
          ) : undefined
        }
      >
        {failed ? (
          <ErrorBlock title="Couldn't load the fault" description={failed} onRetry={() => void load()} />
        ) : !fault ? (
          <LoadingBlock shape="list" label="fault" rows={5} />
        ) : (
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto [&>*]:shrink-0">
            {fault.status === "wont_fix" && fault.wontFixReason ? (
              <Alert status="warning">
                <Alert.Indicator>
                  <Icon name="TriangleExclamation" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Your landlord won't fix this</Alert.Title>
                  <Alert.Description>{fault.wontFixReason}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {fault.reopenUntil ? (
              <p className="text-sm text-muted">
                Not right? You can reopen it until <DateText value={fault.reopenUntil} style="long" />.
              </p>
            ) : null}
            <PhotoGallery
              photos={fault.photos.map((p) => ({ url: p.url, alt: fault.title }))}
              label={fault.title}
              empty={<EmptyBlock icon="Picture" title="No photos" size="sm" />}
            />
            {fault.description ? <p className="text-sm text-pretty whitespace-pre-line">{fault.description}</p> : null}
            <KeyValueList
              items={[
                { label: "Kind", value: fault.category ? FAULT_CATEGORY_LABEL[fault.category] : "Not said" },
                { label: "How urgent", value: FAULT_URGENCY_LABEL[fault.urgency] },
                { label: "Reported", value: <DateText value={fault.reportedAt} style="long" /> },
                { label: "Fixing it", value: fault.assigneeName ?? "Nobody yet" },
                {
                  label: "May come in",
                  value:
                    fault.staffMayEnter === null
                      ? "Not said"
                      : fault.staffMayEnter
                        ? "Yes, when nobody is home"
                        : "Only when you are home",
                },
              ]}
            />
            <section className="flex flex-col gap-2" aria-labelledby="tenant-fault-history">
              <SectionHeader id="tenant-fault-history" title="Timeline" />
              <EventTimeline label="Fault history" events={faultTimeline(fault.events, { showVisibility: false })} />
            </section>
            {fault.status !== "cancelled" ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <TextInput
                  label="Message your landlord"
                  name="body"
                  value={reply}
                  onChange={(v) => {
                    setReply(v);
                    setReplyError(null);
                  }}
                  placeholder={open ? "I'm home after 5 pm." : "A question about this fault"}
                  errorMessage={replyError}
                  multiline
                />
                <ActionButton type="submit" icon="PaperPlane" size="sm" className="self-end" isPending={sending}>
                  Send
                </ActionButton>
              </form>
            ) : null}
          </div>
        )}
      </SidePanel>
      {fault && reopening ? (
        <ReopenDialog
          leaseId={leaseId}
          fault={fault}
          onClose={() => setReopening(false)}
          onReopened={(f) => {
            setFault(f);
            setReopening(false);
          }}
        />
      ) : null}
    </>
  );
}

function ReopenDialog({
  leaseId,
  fault,
  onClose,
  onReopened,
}: {
  leaseId: string;
  fault: TenantFaultDetail;
  onClose: () => void;
  onReopened: (fault: TenantFaultDetail) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      if (reason.trim().length < 3) {
        setError("Say what is still wrong.");
        return;
      }
      const r = await reopenFault(leaseId, fault.id, { reason: reason.trim() });
      if (!r.ok) {
        setError(r.fieldErrors?.reason ?? r.error);
        return;
      }
      toast.success("Reopened. Your landlord is told.");
      onReopened(r.value);
      router.refresh();
    });
  return (
    <FormDialog
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="Reopen this fault?"
      description={`It goes back to your landlord as reported. You can do this up to ${FAULT_REOPEN_DAYS} days after it was settled.`}
      size="sm"
      submitLabel="Reopen"
      submitIcon="ArrowRotateLeft"
      isPending={pending}
      validationErrors={error ? { reason: error } : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextInput
        label="What is still wrong"
        name="reason"
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(null);
        }}
        placeholder="It started leaking again"
        errorMessage={error}
        isRequired
        multiline
        autoFocus
      />
    </FormDialog>
  );
}
