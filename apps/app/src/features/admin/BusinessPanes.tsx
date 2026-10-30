"use client";

import { Clock, Lock } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Label, Tag, TagGroup, TextArea, TextField } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import type { IconName } from "@injishi/data";
import type {
  Availability,
  Business,
  Entitlement,
  KybDocState,
  KybDocumentType,
  Tone,
} from "@injishi/data/fixtures/admin";
import { Icon } from "@injishi/ui";
import { EventTimeline, OptionSelect, ToneChip } from "./shared";

export const DOC_STATE: Record<KybDocState, { label: string; tone: Tone; icon: IconName }> = {
  verified: { label: "Verified", tone: "success", icon: "CircleCheck" },
  unchecked: { label: "Not checked", tone: "warning", icon: "File" },
  reupload: { label: "Re-upload requested", tone: "warning", icon: "FileExclamation" },
  missing: { label: "Missing", tone: "default", icon: "CircleDashed" },
  conflict: { label: "Conflict", tone: "danger", icon: "CircleExclamation" },
  mismatch: { label: "Name mismatch", tone: "danger", icon: "Lock" },
  expired: { label: "Expired", tone: "danger", icon: "Clock" },
};

const AVAILABILITY: Record<Availability, { label: string; tone: Tone }> = {
  included: { label: "Included", tone: "success" },
  addon: { label: "Add-on", tone: "default" },
  none: { label: "Not in plan", tone: "default" },
};

const APPROVERS = [
  { id: "alain", label: "Alain Ntwari · Head of platform operations" },
  { id: "clarisse", label: "Clarisse Umutoni · Platform finance" },
];

const SUSPEND_REASONS = ["Non-payment past grace", "Licence lapsed", "Fraud or abuse", "Owner request"];
const REINSTATE_REASONS = ["Licence renewed", "Debt settled", "Suspended in error"];

/** Documents of a business with reviewer checks applied (checked → verified). */
function businessDocuments(b: Business, types: KybDocumentType[], checked: Record<string, boolean>) {
  return b.documents.map((d) => {
    const type = types.find((t) => t.id === d.type);
    const state: KybDocState = checked[d.type] ? "verified" : d.state;
    const meta = DOC_STATE[state];
    return {
      id: d.type,
      name: type?.name ?? d.type,
      state,
      label: state === d.state && d.label ? d.label : meta.label,
      tone: meta.tone,
      icon: meta.icon,
      note: state === "verified" ? (type?.verifiedNote ?? "") : (d.note ?? ""),
      canCheck: state === "unchecked" || state === "expired",
    };
  });
}

export function KybPane({
  business: b,
  types,
  checked,
  sent,
  changesRequested,
  onCheck,
  onSend,
  onRequestChanges,
}: {
  business: Business;
  types: KybDocumentType[];
  checked: Record<string, boolean>;
  sent: boolean;
  changesRequested: boolean;
  onCheck: (docType: string) => void;
  onSend: () => void;
  onRequestChanges: () => void;
}) {
  const docs = businessDocuments(b, types, checked);
  const allVerified = docs.every((d) => d.state === "verified");
  const blocked = b.documents.some((d) => d.state === "mismatch");
  const inReview = b.stage === "review";
  const note = inReview
    ? sent
      ? "Sent to Compliance · Bosco Rutayisire approves or declines. You cannot approve your own review."
      : allVerified
        ? "All documents verified. Approval is a Compliance decision; you send it with your notes."
        : "Send for approval unlocks when every document is verified. Approval is a Compliance decision."
    : blocked
      ? sent
        ? "Unblock requested · waiting for Compliance."
        : "Your request goes to Compliance with the RDB extract as evidence."
      : b.stage === "suspended"
        ? "The renewed licence must be checked before reinstatement."
        : "KYB complete. Documents are kept under the configured retention policy.";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] leading-[22px] font-semibold">Documents</h3>
        <span className="text-xs text-muted">Reviewer · {b.reviewer}</span>
      </div>
      <ListView aria-label="KYB documents" variant="secondary" items={docs}>
        {(d) => (
          <ListView.Item id={d.id} textValue={d.name}>
            <ListView.ItemContent>
              <Icon name={d.icon} className="size-4 shrink-0" />
              <div className="flex min-w-0 flex-col">
                <ListView.Title>{d.name}</ListView.Title>
                <ListView.Description className="whitespace-normal">{d.note}</ListView.Description>
              </div>
            </ListView.ItemContent>
            <ListView.ItemAction className="flex items-center gap-1.5">
              <ToneChip tone={d.tone}>{d.label}</ToneChip>
              {d.canCheck ? (
                <Button size="sm" variant="ghost" onPress={() => onCheck(d.id)}>
                  Mark checked
                </Button>
              ) : null}
            </ListView.ItemAction>
          </ListView.Item>
        )}
      </ListView>
      {blocked ? (
        <Alert status="warning">
          <Alert.Indicator>
            <Lock />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Blocked at the TIN gate</Alert.Title>
            <Alert.Description>
              RRA lists “{b.entity}”. Unblocking needs evidence that both names are one legal entity and a compliance
              approval. Staff cannot edit RRA records.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {inReview || blocked ? (
        <div className="flex flex-wrap gap-2">
          {inReview ? (
            <Button size="sm" isDisabled={!allVerified || sent} onPress={onSend}>
              Send for approval
            </Button>
          ) : null}
          {blocked ? (
            <Button size="sm" isDisabled={sent} onPress={onSend}>
              Request unblock
            </Button>
          ) : null}
          {inReview ? (
            <Button size="sm" variant="secondary" isDisabled={changesRequested} onPress={onRequestChanges}>
              {changesRequested ? "Changes requested" : "Request changes"}
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className="text-xs leading-4 text-muted">{note}</p>
    </div>
  );
}

export function EntitlementsPane({ business: b, entitlements }: { business: Business; entitlements: Entitlement[] }) {
  const preApproval = b.stage === "draft" || b.stage === "review";
  const grant = preApproval ? "Nothing is provisioned or billed until KYB is approved." : b.grant;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] leading-[22px] font-semibold">{b.plan} plan</h3>
        <span className="text-xs text-muted">
          {preApproval ? "Selected at registration" : "Price book v2 · since 1 Jul 2026"}
        </span>
      </div>
      <ListView aria-label={`${b.plan} plan entitlements`} variant="secondary" items={entitlements}>
        {(e) => {
          const v = e.plans[b.plan];
          const label = preApproval && v !== "none" ? "On approval" : AVAILABILITY[v].label;
          return (
            <ListView.Item id={e.id} textValue={e.name}>
              <ListView.ItemContent>
                <ListView.Title className="font-normal">{e.name}</ListView.Title>
              </ListView.ItemContent>
              <ListView.ItemAction>
                <ToneChip tone={preApproval ? "default" : AVAILABILITY[v].tone}>{label}</ToneChip>
              </ListView.ItemAction>
            </ListView.Item>
          );
        }}
      </ListView>
      <p className="text-xs leading-4 text-muted">
        {grant ? `${grant} ` : ""}Entitlement changes are effective-dated and recorded in the audit log.
      </p>
    </div>
  );
}

export function LifecyclePane({
  business: b,
  reason,
  approver,
  requested,
  onReason,
  onApprover,
  onRequest,
}: {
  business: Business;
  reason: string | undefined;
  approver: string;
  requested: boolean;
  onReason: (reason: string) => void;
  onApprover: (id: string) => void;
  onRequest: () => void;
}) {
  const suspended = b.stage === "suspended";
  const canChange = b.stage === "active" || suspended;
  const reasons = suspended ? REINSTATE_REASONS : SUSPEND_REASONS;
  const selected = reason ?? reasons[suspended ? 0 : 1];
  const approverName = (APPROVERS.find((a) => a.id === approver) ?? APPROVERS[0]).label.split(" · ")[0];

  return (
    <div className="flex flex-col gap-3">
      <EventTimeline
        events={b.history.map((h) => ({ key: `${h.when}-${h.text}`, title: h.text, meta: h.when, status: h.status }))}
      />
      {canChange ? (
        <Card variant="secondary" className="gap-2.5 p-[14px]">
          <h3 className="text-[15px] leading-[22px] font-semibold">
            {suspended ? "Reinstate workspace" : "Suspend workspace"}
          </h3>
          <TagGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[selected]}
            onSelectionChange={(keys) => {
              const k = [...keys][0];
              if (k !== undefined) onReason(String(k));
            }}
            size="sm"
            className="flex flex-col gap-1"
          >
            <Label>Reason</Label>
            <TagGroup.List className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <Tag key={r} id={r}>
                  {r}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
          <TextField
            key={b.id}
            fullWidth
            defaultValue={
              suspended
                ? "Owner uploaded the renewed RDB licence (valid to 30 Sep 2027). Check it before reinstating."
                : ""
            }
          >
            <Label>Details and evidence</Label>
            <TextArea rows={2} />
          </TextField>
          <OptionSelect label="Second approver" options={APPROVERS} value={approver} onChange={onApprover} />
          <p className="text-xs leading-4 text-muted">
            {suspended
              ? "Reinstatement restores bookings, payments and listings from the approved time. Billing restarts on the next 1st."
              : "While suspended the owner keeps read access to bookings, folios, fiscal and financial exports. Confirmed stays are not cancelled automatically; the listing is hidden."}
          </p>
          {requested ? (
            <Chip variant="soft" color="warning" className="self-start">
              <Clock className="size-3" />
              <Chip.Label>Awaiting approval · {approverName} · requested 09:42</Chip.Label>
            </Chip>
          ) : (
            <Button
              size="sm"
              variant={suspended ? "primary" : "danger-soft"}
              className="self-start"
              onPress={onRequest}
            >
              {suspended ? "Request reinstatement" : "Request suspension"}
            </Button>
          )}
        </Card>
      ) : (
        <p className="text-[13px] leading-[18px] text-muted">
          Suspension applies to active workspaces. A draft or in-review business can only be closed at the owner’s
          request.
        </p>
      )}
    </div>
  );
}
