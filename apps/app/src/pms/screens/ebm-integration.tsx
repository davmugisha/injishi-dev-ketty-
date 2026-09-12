"use client";

/**
 * Settings · Integrations · RRA EBM invoicing (ADR-041, F-B13).
 *
 * **On real data.** Reads `GET /api/v1/ops/ebm/connection` and, once
 * connected, the taxpayer's own catalog and customer list; commands
 * `POST /ops/ebm/connect`, `PUT /ops/ebm/mapping` and
 * `DELETE /ops/ebm/connection`. Every route needs `ebm.manage`, so nothing is
 * asked for on behalf of a caller who does not hold it.
 *
 * What an owner does here, in order: connect the business's own EBM account
 * (the provider's consent screen, then back to this page), check the TIN is
 * theirs, and choose which catalog items a room night and the service fee are
 * sold as and which customer walk-in guests are billed to. Until all of that
 * is done, confirmed sales wait as HELD — never dropped — and this page says
 * how many.
 *
 * **Leaving the app is visible.** Connect answers a URL and this screen sends
 * the browser there itself; the provider sends it back with `?ebm=…`, which is
 * turned into a sentence here and then cleared from the address bar so a
 * reload does not repeat it.
 */

import type { EbmAccountStatus, EbmConnection, EbmItemMappingInput } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  ActionButton,
  Badge,
  EmptyState,
  FieldLabel,
  SectionHeading,
  SelectField,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import {
  useDisconnectEbm,
  useEbmConnection,
  useEbmCustomers,
  useEbmItems,
  useSaveEbmMapping,
  useStartEbmConnect,
} from "../data/ebm";
import { usePms } from "../store";

/** The callback's reason codes (`ConnectFailure` on the API), in words. */
const RETURN_REASON: Record<string, string> = {
  denied: "The connection was not approved on the EBM consent screen. Nothing changed.",
  expired: "That connection attempt expired or was already used. Start it again.",
  wrong_user: "That connection was started by someone else. Start it again from your own session.",
  tin_mismatch:
    "That EBM account belongs to a different TIN than this business, so it was not connected. Sign in to the business's own EBM account.",
  no_tin: "This business has no TIN on record, so no EBM account can be matched to it.",
  account_disabled: "That EBM account is disabled at the provider, so it was not connected.",
  provider_error: "The EBM provider could not complete the connection. Try again shortly.",
};

const ACCOUNT_STATUS: Record<EbmAccountStatus, { label: string; intent: "ok" | "warn" | "bad" }> = {
  approved: { label: "Approved by RRA", intent: "ok" },
  submitted: { label: "Waiting for RRA approval", intent: "warn" },
  disabled: { label: "Disabled", intent: "bad" },
};

export function EbmIntegration() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor, isLoading: capabilityLoading } = useCapability();
  const mayManage = can("ebm.manage");
  const connection = useEbmConnection(workspaceId, mayManage);

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHeading>RRA EBM invoicing</SectionHeading>
      <ReturnNotice />
      {capabilityLoading ? (
        <Skeleton height={140} />
      ) : !mayManage ? (
        <EmptyState>
          {reasonFor("ebm.manage") ?? "Only an owner or manager can connect the business's RRA EBM account."}
        </EmptyState>
      ) : connection.isPending ? (
        <Skeleton height={140} />
      ) : connection.isError ? (
        <EmptyState>
          We couldn&apos;t load the EBM connection.{" "}
          <button type="button" className="font-semibold text-accent-text underline" onClick={() => void connection.refetch()}>
            Try again
          </button>
        </EmptyState>
      ) : (
        <ConnectionPanel workspaceId={workspaceId} connection={connection.data} />
      )}
    </section>
  );
}

/**
 * The sentence for `?ebm=connected` / `?ebm=error&reason=…`, shown once.
 * The parameters are read into state and then removed from the URL, so the
 * notice survives the re-render but not a reload or a shared link.
 */
function ReturnNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const outcome = params?.get("ebm");
  const reason = params?.get("reason") ?? "";
  useEffect(() => {
    if (!outcome) return;
    setNotice(
      outcome === "connected"
        ? { ok: true, text: "EBM account connected. Check the TIN below, then choose the items stays are sold as." }
        : { ok: false, text: RETURN_REASON[reason] ?? "The EBM connection did not complete. Try again." },
    );
    router.replace(pathname ?? "/");
  }, [outcome, reason, router, pathname]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className={cn(
        "rounded border px-4 py-3 text-sm",
        notice.ok ? "border-ok bg-ok-bg text-ok" : "border-bad bg-bad-bg text-bad",
      )}
    >
      {notice.text}
    </div>
  );
}

function ConnectionPanel({
  workspaceId,
  connection,
}: {
  workspaceId: string | null;
  connection: EbmConnection;
}) {
  if (connection.mode === "mock") {
    return (
      <div className={cn(surfaceClass, "flex flex-col gap-2 px-5 py-4")}>
        <div className="flex items-center gap-2">
          <Badge intent="neutral">Not switched on</Badge>
          <span className="text-sm font-semibold text-ink">RRA invoicing runs in mock mode here</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Guest receipts print the RRA layout and are marked NOT A FISCAL RECEIPT. Nothing is sent to RRA on this
          deployment, so there is no EBM account to connect.
        </p>
        {connection.heldSaleCount > 0 && <HeldSales count={connection.heldSaleCount} />}
      </div>
    );
  }

  if (connection.status !== "connected") {
    return <NotConnected workspaceId={workspaceId} connection={connection} />;
  }
  return <Connected workspaceId={workspaceId} connection={connection} />;
}

function HeldSales({ count }: { count: number }) {
  return (
    <p className="text-sm font-semibold text-warn">
      {count === 1 ? "1 confirmed sale is" : `${count} confirmed sales are`} waiting to be certified. Nothing is
      lost; they go out as soon as the account is connected and set up.
    </p>
  );
}

function NotConnected({ workspaceId, connection }: { workspaceId: string | null; connection: EbmConnection }) {
  const { toast, toastError } = usePms();
  const connect = useStartEbmConnect(workspaceId);
  const revoked = connection.status === "revoked";

  function start() {
    connect.mutate(undefined, {
      // Sent from here, visibly: the person is about to leave the app for the
      // provider's consent screen and will come back to this page.
      onSuccess: ({ authorizeUrl }) => window.location.assign(authorizeUrl),
      onError: toastError,
    });
  }

  return (
    <div className={cn(surfaceClass, "flex flex-col gap-3 px-5 py-4")}>
      <div className="flex flex-wrap items-center gap-2">
        {revoked ? <Badge intent="bad">Disconnected</Badge> : <Badge intent="neutral">Not connected</Badge>}
        <span className="text-sm font-semibold text-ink">
          {revoked ? "The EBM authorisation stopped working" : "Connect the business's RRA EBM account"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Every confirmed booking is certified with RRA under this business&apos;s own TIN, through its account at the
        Injishi EBM provider. You will sign in there and approve access; the account must carry this business&apos;s
        TIN or it is refused.
      </p>
      {revoked && connection.tin && (
        <p className="text-xs text-muted-foreground">Last connected as TIN {connection.tin}.</p>
      )}
      {connection.heldSaleCount > 0 && <HeldSales count={connection.heldSaleCount} />}
      <div>
        <ActionButton variant="primary" onClick={start} disabled={connect.isPending}>
          {connect.isPending ? "Opening the EBM provider…" : revoked ? "Reconnect EBM account" : "Connect EBM account"}
        </ActionButton>
      </div>
    </div>
  );
}

function Connected({ workspaceId, connection }: { workspaceId: string | null; connection: EbmConnection }) {
  const status = connection.accountStatus ? ACCOUNT_STATUS[connection.accountStatus] : null;

  return (
    <div className={cn(surfaceClass, "flex flex-col gap-4 px-5 py-4")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge intent={connection.isReady ? "ok" : "warn"}>{connection.isReady ? "Ready to invoice" : "Not ready yet"}</Badge>
        {status && <Badge intent={status.intent}>{status.label}</Badge>}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Fact label="TIN" value={connection.tin ?? "—"} strong />
        <Fact label="EBM account" value={connection.accountName ?? "—"} />
        <Fact label="Branch" value={connection.branchId ?? "—"} />
        <Fact
          label="VAT registered"
          value={connection.vatRegistered === null ? "—" : connection.vatRegistered ? "Yes" : "No"}
        />
        <Fact
          label="Connected"
          value={connection.connectedAt ? new Date(connection.connectedAt).toLocaleDateString("en-GB") : "—"}
        />
      </dl>

      {connection.accountStatus === "submitted" && (
        <p className="text-sm text-muted-foreground">
          RRA has not approved this EBM account yet. Sales wait until it does; reopen this page to check again.
        </p>
      )}
      {connection.heldSaleCount > 0 && <HeldSales count={connection.heldSaleCount} />}

      <MappingForm workspaceId={workspaceId} connection={connection} />
      <Disconnect workspaceId={workspaceId} />
    </div>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("pms-num", strong ? "font-bold text-ink" : "text-ink2")}>{value}</dd>
    </div>
  );
}

/**
 * The three picks, offered only from choices the server will accept: items
 * taxed at B (a stay is invoiced at VAT B-18%) and customers with no TIN (a
 * customer with a TIN makes the sale B2B). The server checks again; filtering
 * here only saves the person from picking something that will be refused.
 */
function MappingForm({ workspaceId, connection }: { workspaceId: string | null; connection: EbmConnection }) {
  const { toast, toastError } = usePms();
  const items = useEbmItems(workspaceId, true);
  const customers = useEbmCustomers(workspaceId, true);
  const save = useSaveEbmMapping(workspaceId);

  const saved = connection.mapping;
  const [draft, setDraft] = useState<EbmItemMappingInput>(saved);
  // A fresh answer from the server (a save, a refetch) is the new baseline.
  useEffect(() => setDraft(saved), [saved]);

  const itemOptions = useMemo(
    () =>
      (items.data?.items ?? [])
        .filter((item) => item.taxTyCd === "B")
        .map((item) => ({ value: String(item.id), label: `${item.itemNm} · ${item.itemCd}` })),
    [items.data],
  );
  const customerOptions = useMemo(
    () =>
      (customers.data?.customers ?? [])
        .filter((customer) => !customer.tin)
        .map((customer) => ({ value: String(customer.id), label: customer.name || `Customer ${customer.id}` })),
    [customers.data],
  );

  const changed =
    draft.accommodationItemId !== saved.accommodationItemId ||
    draft.serviceFeeItemId !== saved.serviceFeeItemId ||
    draft.walkInCustomerId !== saved.walkInCustomerId;

  function pick(field: keyof EbmItemMappingInput) {
    return (value: string) => setDraft((d) => ({ ...d, [field]: value === "" ? null : Number(value) }));
  }

  function submit() {
    save.mutate(draft, {
      onSuccess: (next) =>
        toast(next.isReady ? "Saved. This business is ready to invoice." : "Saved.", "ok"),
      onError: toastError,
    });
  }

  if (items.isPending || customers.isPending) return <Skeleton height={120} />;
  if (items.isError || customers.isError) {
    return (
      <EmptyState>
        We couldn&apos;t read this business&apos;s EBM catalog.{" "}
        <button
          type="button"
          className="font-semibold text-accent-text underline"
          onClick={() => {
            void items.refetch();
            void customers.refetch();
          }}
        >
          Try again
        </button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="text-sm text-muted-foreground">
        RRA invoices are issued against items registered in the business&apos;s EBM catalog. Choose what each part of a
        stay is sold as. Only items taxed at B (18% VAT) and customers with no TIN are offered.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Room night</FieldLabel>
          <SelectField
            label="Catalog item a room night is sold as"
            value={draft.accommodationItemId === null ? "" : String(draft.accommodationItemId)}
            onChange={pick("accommodationItemId")}
            options={itemOptions}
            placeholder={itemOptions.length ? "Choose an item" : "No B-taxed items"}
            disabled={save.isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Booking service fee</FieldLabel>
          <SelectField
            label="Catalog item the booking service fee is sold as"
            value={draft.serviceFeeItemId === null ? "" : String(draft.serviceFeeItemId)}
            onChange={pick("serviceFeeItemId")}
            options={itemOptions}
            placeholder={itemOptions.length ? "Choose an item" : "No B-taxed items"}
            disabled={save.isPending}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Walk-in customer</FieldLabel>
          <SelectField
            label="EBM customer booking guests are billed to"
            value={draft.walkInCustomerId === null ? "" : String(draft.walkInCustomerId)}
            onChange={pick("walkInCustomerId")}
            options={customerOptions}
            placeholder={customerOptions.length ? "Choose a customer" : "No customers without a TIN"}
            disabled={save.isPending}
          />
        </div>
      </div>
      {itemOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add an item taxed at B to the business&apos;s catalog in the EBM provider, then reopen this page.
        </p>
      )}
      <div>
        <ActionButton variant="primary" onClick={submit} disabled={!changed} pending={save.isPending}>
          {save.isPending ? "Saving your items" : "Save items"}
        </ActionButton>
      </div>
    </div>
  );
}

/** Two steps, because the first click should not stop a business invoicing. */
function Disconnect({ workspaceId }: { workspaceId: string | null }) {
  const { toast, toastError } = usePms();
  const disconnect = useDisconnectEbm(workspaceId);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="border-t border-line pt-4">
        <ActionButton onClick={() => setConfirming(true)}>Disconnect EBM account</ActionButton>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <p className="text-sm text-ink2">
        Disconnect? Sales confirmed from now on will wait as held until an account is connected again. Nothing already
        certified changes.
      </p>
      <div className="flex gap-2">
        {/* DANGER, not primary. The confirming button was styled as the green
            recommended action, which is the opposite of what it does: every
            sale confirmed after this is held until an account is connected
            again. The safe half is the one that keeps it. */}
        <Button
          variant="danger"
          size="sm"
          shape="rounded"
          className="font-semibold whitespace-nowrap"
          pending={disconnect.isPending}
          onClick={() =>
            disconnect.mutate(undefined, {
              onSuccess: () => {
                setConfirming(false);
                toast(
                  "The EBM account is disconnected. Sales from now on are held until one is connected again.",
                  "ok",
                );
              },
              onError: toastError,
            })
          }
        >
          {disconnect.isPending ? "Disconnecting" : "Yes, disconnect"}
        </Button>
        <ActionButton onClick={() => setConfirming(false)} disabled={disconnect.isPending}>
          Keep it connected
        </ActionButton>
      </div>
    </div>
  );
}
