"use client";

import {
  ArrowsRotateRight,
  CircleCheckFill,
  Comments,
  CommentsDot,
  PaperPlane,
  PersonPlus,
  Wallet,
  Wrench,
  Xmark,
} from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Input, TextField, toast } from "@heroui/react";
import { ItemCard, ListView } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  MessageThread,
  RenewalOffer,
  RentCharge,
  RentReceipt,
  ResidentNotice,
  Tenancy,
  ThreadMessage,
} from "@injishi/data/fixtures/resident";
import { formatRwf, Icon, LinkButton, PhoneBody, PhoneTop, StatusDot } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhoneSheet } from "@/components/phone/PhoneSheet";
import { sendMessageAction } from "./actions";
import { downloadText, PhoneToasts, pressableCard, renderButton, renderSection, SectionTitle, ToneChip } from "./parts";

/**
 * Resident home: rent due, renewal, quick actions, deposit, notices and messages (artifact: TenantHome). A tenant
 * with no charge this month, no verified payment yet, no renewal offer or no conversation sees that part left
 * out or said plainly, never a 404.
 */
export function TenantHomeView({
  persona,
  tenancy,
  charge,
  receipt,
  notices,
  thread,
  messages,
  offer,
}: {
  persona: Persona;
  tenancy: Tenancy;
  charge: RentCharge | null;
  receipt: RentReceipt | null;
  notices: ResidentNotice[];
  thread: MessageThread | null;
  messages: ThreadMessage[];
  offer: RenewalOffer | null;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<ThreadMessage[]>([]);
  const router = useRouter();
  // A sent line stays until the server's copy of the conversation carries it.
  const threadMessages = [
    ...messages,
    ...sent.filter((s) => !messages.some((m) => m.from === "resident" && m.text === s.text)),
  ];
  const unreadLabel =
    thread && thread.unread > 0 ? `Messages from management, ${thread.unread} unread` : "Messages from management";
  const openMessages = () => {
    if (thread) setOpen(true);
    else toast.warning("You have no conversation with management yet. Request a repair to start one.");
  };

  /** Send message → `POST /me/threads/:id/messages`; shown at once, then read back from the server. */
  const send = async () => {
    const text = draft.trim();
    if (!text || !thread) return;
    const local: ThreadMessage = {
      id: `local-${Date.now()}`,
      thread: thread.id,
      from: "resident",
      text,
      meta: "You · just now · sending",
    };
    setSent((items) => [...items, local]);
    setDraft("");
    const result = await sendMessageAction(thread.id, text);
    if (!result.ok) {
      setSent((items) => items.filter((m) => m.id !== local.id));
      setDraft(text);
      toast.danger(result.error);
      return;
    }
    setSent((items) => items.map((m) => (m.id === local.id ? { ...m, meta: "You · just now · sent" } : m)));
    router.refresh();
  };

  const saveReceipt = () => {
    if (!receipt) return;
    downloadText(`receipt-${receipt.id}.txt`, [
      "Payment receipt",
      `${receipt.month} rent`,
      `Amount: ${formatRwf(receipt.amount)}`,
      `Verified: ${receipt.verifiedAt}`,
      `Network: ${receipt.network}`,
      `Provider ref: ${receipt.providerRef}`,
      `Paid to: ${tenancy.landlord}`,
      "Not a tax invoice",
    ]);
  };

  return (
    <>
      <PhoneTop>
        <Avatar size="sm" variant="soft" color="accent">
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] leading-[18px] font-semibold">{persona.name}</span>
          <span className="text-[12px] leading-4 text-muted">
            Unit {tenancy.unit} · {tenancy.property}
          </span>
        </div>
        <Button isIconOnly variant="ghost" aria-label={unreadLabel} onPress={openMessages}>
          <CommentsDot className="size-5" />
        </Button>
      </PhoneTop>

      <PhoneBody>
        <Card render={renderSection} aria-labelledby="rent-h" className="gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span id="rent-h" className="text-[12px] text-muted">
                {charge ? `${charge.month} rent` : "Rent this month"}
              </span>
              <span className="text-[26px] leading-8 font-[650] tabular">{formatRwf(charge?.amount ?? 0)}</span>
              <span className="text-[13px] leading-[18px]">
                {charge ? `Due ${charge.due} · ${charge.dueIn}` : "No rent charge raised on your lease yet"}
              </span>
            </div>
            {charge ? <ToneChip tone={charge.statusTone}>{charge.status}</ToneChip> : null}
          </div>
          <LinkButton href={screenHref("TenantPay")} size="lg" fullWidth>
            <Wallet className="size-4" />
            Pay rent
          </LinkButton>
          {receipt ? (
            <div className="flex items-start gap-[10px] border-t border-separator pt-1">
              <CircleCheckFill className="mt-[10px] size-4 shrink-0 text-success" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col pt-2">
                <span className="text-[13px] font-medium">Last payment · {receipt.month} rent</span>
                <span className="text-[12px] leading-4 text-muted tabular">
                  {formatRwf(receipt.amount)} · verified {receipt.verifiedAt} · {receipt.network} · ref{" "}
                  {receipt.providerRef}
                </span>
              </div>
              <Button size="sm" variant="ghost" className="mt-1.5" onPress={saveReceipt}>
                Receipt
              </Button>
            </div>
          ) : null}
        </Card>

        {offer ? (
          <NextLink href={screenHref("TenantLease")} className="block text-inherit no-underline">
            <Alert status="warning">
              <Alert.Indicator>
                <ArrowsRotateRight />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Renewal offer: answer by {offer.answerByDay}</Alert.Title>
                <Alert.Description>
                  {offer.months} more months from {offer.starts} at {formatRwf(offer.rent)}. Tap to review in your
                  lease.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </NextLink>
        ) : null}

        <section className="flex flex-col gap-2" aria-labelledby="qa-h">
          <SectionTitle id="qa-h">Quick actions</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            <Card<"a">
              render={(props) => <NextLink href={screenHref("TenantRequests")} {...props} />}
              className="min-h-[88px] items-start gap-[6px] p-3 text-inherit no-underline"
            >
              <Wrench className="size-[18px] text-accent" aria-hidden="true" />
              <span className="text-[13px] leading-[17px] font-medium">Request a repair</span>
            </Card>
            <Card<"a">
              render={(props) => <NextLink href={screenHref("TenantRequests")} {...props} />}
              className="min-h-[88px] items-start gap-[6px] p-3 text-inherit no-underline"
            >
              <PersonPlus className="size-[18px] text-accent" aria-hidden="true" />
              <span className="text-[13px] leading-[17px] font-medium">Register a visitor</span>
            </Card>
            <Card<"button">
              render={renderButton}
              onClick={openMessages}
              className={`${pressableCard} min-h-[88px] items-start gap-[6px] p-3 text-left`}
            >
              <Comments className="size-[18px] text-accent" aria-hidden="true" />
              <span className="text-[13px] leading-[17px] font-medium">Message management</span>
            </Card>
          </div>
        </section>

        <Card render={renderSection} variant="secondary" aria-labelledby="dep-h" className="gap-[6px] px-4 py-[14px]">
          <div className="flex items-center justify-between gap-3">
            <span id="dep-h" className="text-[13px] font-semibold">
              Caution deposit
            </span>
            <span className="font-[650] tabular">{tenancy.deposit ? formatRwf(tenancy.deposit) : "Not recorded"}</span>
          </div>
          <span className="text-[12px] leading-4 text-muted">
            As agreed in your lease with {tenancy.landlord}. Returned after your move-out inspection, less any
            deductions you can review and dispute.
          </span>
        </Card>

        <section className="flex flex-col gap-2" aria-labelledby="not-h">
          <SectionTitle id="not-h">Notices from management</SectionTitle>
          <ListView aria-label="Notices from management">
            {notices.map((n) => (
              <ListView.Item key={n.id} id={n.id} textValue={n.title} className="items-start">
                <ListView.ItemContent className="items-start">
                  <Icon name={n.icon} className="mt-0.5 size-4 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="whitespace-normal">{n.title}</ListView.Title>
                    <ListView.Description className="whitespace-normal">{n.desc}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                {n.isNew ? (
                  <ListView.ItemAction>
                    <ToneChip tone="accent" size="sm">
                      New
                    </ToneChip>
                  </ListView.ItemAction>
                ) : null}
              </ListView.Item>
            ))}
          </ListView>
        </section>

        {thread ? (
          <section className="flex flex-col gap-2" aria-labelledby="msg-h">
            <SectionTitle id="msg-h">Messages</SectionTitle>
            <ItemCard<"button">
              render={renderButton}
              onClick={() => setOpen(true)}
              className={`${pressableCard} w-full text-left`}
            >
              <ItemCard.Icon>
                <Wrench />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>{thread.title}</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">{thread.preview}</ItemCard.Description>
              </ItemCard.Content>
              {thread.unread > 0 ? (
                <ItemCard.Action>
                  <StatusDot tone="accent" />
                  <span className="sr-only">Unread</span>
                </ItemCard.Action>
              ) : null}
            </ItemCard>
          </section>
        ) : null}
      </PhoneBody>

      <PhoneSheet
        isOpen={open}
        onOpenChange={setOpen}
        heading={
          <span className="flex w-full items-center justify-between gap-2">
            <span>{thread?.title}</span>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Close" onPress={() => setOpen(false)}>
              <Xmark />
            </Button>
          </span>
        }
        description={thread?.subtitle}
      >
        {threadMessages.map((m) => {
          const mine = m.from === "resident";
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className={`flex max-w-[82%] flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`rounded-[16px] px-3 py-2.5 ${mine ? "bg-accent text-accent-foreground" : "bg-surface-secondary"}`}
                >
                  <span className="text-[14px] leading-5">{m.text}</span>
                </div>
                <span className="text-[11px] text-muted">{m.meta}</span>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-2">
          <TextField aria-label="Message" value={draft} onChange={setDraft} className="min-w-0 flex-1">
            <Input placeholder="Write a message" />
          </TextField>
          <Button isIconOnly variant="primary" aria-label="Send message" onPress={send}>
            <PaperPlane />
          </Button>
        </div>
        <span className="text-[12px] text-muted">For emergencies call the caretaker at the gate.</span>
      </PhoneSheet>
      <PhoneToasts />
    </>
  );
}
