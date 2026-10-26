import { screenHref } from "@injishi/data";
import type {
  MessageThread,
  RenewalOffer,
  RentCharge,
  RentReceipt,
  ResidentNotice,
  Tenancy,
  ThreadMessage,
} from "@injishi/data/fixtures/resident";
import { Link } from "expo-router";
import { Avatar, Button, Card, Input, TextField } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection } from "@/lib/store";
import { downloadText, formatRwf, PhoneSheet, RowList, SectionTitle, StatusAlert, ToneChip } from "./ui";

/** Resident home: rent due, renewal, quick actions, deposit, notices and messages (artifact: TenantHome). */
export default function TenantHomeScreen() {
  const { persona } = useSession();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<ThreadMessage[]>([]);

  const tenancies = getCollection<Tenancy>("resident.tenancies");
  const charges = getCollection<RentCharge>("resident.rentCharges");
  const receipts = getCollection<RentReceipt>("resident.receipts");
  const notices = getCollection<ResidentNotice>("resident.notices");
  const threads = getCollection<MessageThread>("resident.threads");
  const allMessages = getCollection<ThreadMessage>("resident.messages");
  const offers = getCollection<RenewalOffer>("resident.renewalOffers");

  const tenancy = tenancies.find((item) => item.persona === persona?.id) ?? tenancies[0];
  const charge = tenancy ? charges.find((item) => item.lease === tenancy.id) : undefined;
  const offer = tenancy ? offers.find((item) => item.lease === tenancy.id) : undefined;
  const thread = threads[0];
  const receipt = receipts[0];
  if (!persona || !tenancy || !charge || !receipt || !offer || !thread) return null;

  const messages = allMessages.filter((item) => item.thread === thread.id);
  const threadMessages = [...messages, ...sent];
  const unreadLabel =
    thread.unread > 0 ? `Messages from management, ${thread.unread} unread` : "Messages from management";

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setSent((items) => [
      ...items,
      {
        id: `local-${items.length + 1}`,
        thread: thread.id,
        from: "resident",
        text,
        meta: "You · just now · sent",
      },
    ]);
    setDraft("");
  };

  const saveReceipt = () => {
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
        <Avatar size="sm" variant="soft" color="accent" alt={persona.name}>
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] leading-[18px] font-semibold text-foreground">{persona.name}</Text>
          <Text className="text-[12px] leading-4 text-muted">
            Unit {tenancy.unit} · {tenancy.property}
          </Text>
        </View>
        <Button variant="ghost" isIconOnly accessibilityLabel={unreadLabel} onPress={() => setOpen(true)}>
          <Icon name="CommentsDot" size={20} />
        </Button>
      </PhoneTop>

      <PhoneBody>
        <Card accessibilityLabel="October rent" className="gap-3 p-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="min-w-0 flex-1">
              <Text className="text-xs text-muted">{charge.month} rent</Text>
              <Text className="text-[26px] leading-8 font-semibold text-foreground">{formatRwf(charge.amount)}</Text>
              <Text className="text-[13px] leading-[18px] text-foreground">
                Due {charge.due} · {charge.dueIn}
              </Text>
            </View>
            <ToneChip tone={charge.statusTone}>{charge.status}</ToneChip>
          </View>
          <Link href={screenHref("TenantPay") as never} asChild>
            <Button size="lg" className="w-full">
              <Icon name="Wallet" tone="accent-foreground" />
              <Button.Label>Pay rent</Button.Label>
            </Button>
          </Link>
          <View className="flex-row items-start gap-[10px] border-t border-separator pt-1">
            <View className="mt-[10px]">
              <Icon name="CircleCheckFill" tone="success" />
            </View>
            <View className="min-w-0 flex-1 pt-2">
              <Text className="text-[13px] font-medium text-foreground">Last payment · {receipt.month} rent</Text>
              <Text className="text-xs leading-4 text-muted">
                {formatRwf(receipt.amount)} · verified {receipt.verifiedAt} · {receipt.network} · ref{" "}
                {receipt.providerRef}
              </Text>
            </View>
            <Button size="sm" variant="ghost" className="mt-1.5" onPress={saveReceipt}>
              <Button.Label>Receipt</Button.Label>
            </Button>
          </View>
        </Card>

        <Link href={screenHref("TenantLease") as never} asChild>
          <Pressable accessibilityRole="link">
            <StatusAlert
              status="warning"
              icon="ArrowsRotateRight"
              title={`Renewal offer: answer by ${offer.answerByDay}`}
              description={`${offer.months} more months from ${offer.starts} at ${formatRwf(offer.rent)}. Tap to review in your lease.`}
            />
          </Pressable>
        </Link>

        <View className="gap-2">
          <SectionTitle>Quick actions</SectionTitle>
          <View className="flex-row gap-2">
            <Link href={screenHref("TenantRequests") as never} asChild>
              <Pressable accessibilityRole="link" className="min-h-[88px] flex-1">
                <Card className="min-h-[88px] flex-1 items-start gap-[6px] p-3">
                  <Icon name="Wrench" size={18} tone="accent" />
                  <Text className="text-[13px] leading-[17px] font-medium text-foreground">Request a repair</Text>
                </Card>
              </Pressable>
            </Link>
            <Link href={screenHref("TenantRequests") as never} asChild>
              <Pressable accessibilityRole="link" className="min-h-[88px] flex-1">
                <Card className="min-h-[88px] flex-1 items-start gap-[6px] p-3">
                  <Icon name="PersonPlus" size={18} tone="accent" />
                  <Text className="text-[13px] leading-[17px] font-medium text-foreground">Register a visitor</Text>
                </Card>
              </Pressable>
            </Link>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Message management"
              onPress={() => setOpen(true)}
              className="min-h-[88px] flex-1"
            >
              <Card className="min-h-[88px] flex-1 items-start gap-[6px] p-3">
                <Icon name="Comments" size={18} tone="accent" />
                <Text className="text-[13px] leading-[17px] font-medium text-foreground">Message management</Text>
              </Card>
            </Pressable>
          </View>
        </View>

        <Card variant="secondary" className="gap-[6px] px-4 py-[14px]">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-[13px] font-semibold text-foreground">Caution deposit held</Text>
            <Text className="font-semibold text-foreground">{formatRwf(tenancy.deposit)}</Text>
          </View>
          <Text className="text-xs leading-4 text-muted">
            Held by {tenancy.landlord} since {tenancy.depositSince}. Returned after your move-out inspection, less any
            deductions you can review and dispute.
          </Text>
        </Card>

        <View className="gap-2">
          <SectionTitle>Notices from management</SectionTitle>
          <RowList
            label="Notices from management"
            rows={notices.map((notice) => ({
              id: notice.id,
              icon: notice.icon,
              title: notice.title,
              desc: notice.desc,
              chip: notice.isNew ? "New" : undefined,
              tone: notice.isNew ? "accent" : undefined,
            }))}
          />
        </View>

        <View className="gap-2">
          <SectionTitle>Messages</SectionTitle>
          <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
            <Card className="flex-row items-center gap-3 p-3">
              <View className="size-10 items-center justify-center rounded-xl bg-default">
                <Icon name={thread.icon} />
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-medium text-foreground">{thread.title}</Text>
                <Text className="text-[13px] leading-[18px] text-muted">{thread.preview}</Text>
              </View>
              {thread.unread > 0 ? (
                <View className="size-2 items-center justify-center">
                  <View className="size-2 rounded-full bg-accent" accessibilityLabel="Unread" />
                  <Text className="absolute h-px w-px overflow-hidden opacity-0">Unread</Text>
                </View>
              ) : null}
            </Card>
          </Pressable>
        </View>
      </PhoneBody>

      <PhoneSheet
        isOpen={open}
        onOpenChange={setOpen}
        heading={thread.title}
        description={thread.subtitle}
        onClose={() => setOpen(false)}
      >
        {threadMessages.map((message) => {
          const mine = message.from === "resident";
          return (
            <View key={message.id} className={mine ? "items-end" : "items-start"}>
              <View className={`max-w-[82%] gap-0.5 ${mine ? "items-end" : "items-start"}`}>
                <View className={`rounded-[16px] px-3 py-2.5 ${mine ? "bg-accent" : "bg-surface-secondary"}`}>
                  <Text className={`text-sm leading-5 ${mine ? "text-accent-foreground" : "text-foreground"}`}>
                    {message.text}
                  </Text>
                </View>
                <Text className="text-[11px] text-muted">{message.meta}</Text>
              </View>
            </View>
          );
        })}
        <View className="flex-row items-center gap-2">
          <TextField className="min-w-0 flex-1">
            <Input accessibilityLabel="Message" placeholder="Write a message" value={draft} onChangeText={setDraft} />
          </TextField>
          <Button isIconOnly accessibilityLabel="Send message" onPress={send}>
            <Icon name="PaperPlane" tone="accent-foreground" />
          </Button>
        </View>
        <Text className="text-xs text-muted">
          Management usually replies within a working day. For emergencies call the caretaker at the gate.
        </Text>
      </PhoneSheet>
    </>
  );
}
