import type {
  LeaseDocument,
  MoveOutNotice,
  MoveOutStep,
  NoticeReason,
  RenewalOffer,
  Tenancy,
} from "@injishi/data/fixtures/resident";
import { Button, Card, Description, Input, Label, TextArea, TextField } from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection } from "@/lib/store";
import {
  ChoiceField,
  formatNumber,
  formatRwf,
  KeyValue,
  PhoneSheet,
  PhoneTitle,
  RowList,
  SectionTitle,
  StatusAlert,
  Timeline,
  ToneChip,
} from "./ui";

type OfferState = RenewalOffer["status"];

/** Lease summary, renewal offer, documents and move-out notice (artifact: TenantLease). */
export default function TenantLeaseScreen() {
  const { persona } = useSession();
  const [offerState, setOfferState] = useState<OfferState | null>(null);
  const [notice, setNotice] = useState<MoveOutNotice | null | undefined>(undefined);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [moveOut, setMoveOut] = useState<string | null>(null);

  const tenancies = getCollection<Tenancy>("resident.tenancies");
  const offers = getCollection<RenewalOffer>("resident.renewalOffers");
  const documents = getCollection<LeaseDocument>("resident.leaseDocuments");
  const steps = getCollection<MoveOutStep>("resident.moveOutSteps");
  const reasons = getCollection<NoticeReason>("resident.noticeReasons");

  const tenancy = tenancies.find((item) => item.persona === persona?.id) ?? tenancies[0];
  const offer = tenancy ? offers.find((item) => item.lease === tenancy.id) : undefined;
  if (!tenancy || !offer || !documents.length || !steps.length || !reasons.length) return null;

  const currentOffer = offerState ?? offer.status;
  const currentNotice = notice === undefined ? tenancy.notice : notice;
  const noticeOn = currentNotice !== null;
  const accepted = currentOffer === "accepted";
  const noticeLocked = noticeOn || accepted;
  const chip = noticeOn
    ? { label: "Notice given", tone: "accent" as const }
    : accepted
      ? { label: "Renewing", tone: "info" as const }
      : { label: tenancy.status, tone: tenancy.statusTone };
  const reasonId = reason ?? reasons[0].id;
  const moveOutValue = moveOut ?? tenancy.moveOutDefault;

  const docs: LeaseDocument[] = [
    ...(currentNotice
      ? [
          {
            id: "notice-move-out",
            icon: "PaperPlane" as const,
            title: "Notice to move out",
            desc: `Sent today · move-out ${currentNotice.moveOut}`,
            state: "Awaiting acknowledgement",
            tone: "info" as const,
          },
        ]
      : []),
    ...(accepted
      ? [
          {
            id: "renewal-amendment",
            icon: "Pencil" as const,
            title: "Renewal amendment",
            desc: "Sent today · sign with a one-time code",
            state: "Your signature needed",
            tone: "warning" as const,
          },
        ]
      : []),
    ...documents,
  ];

  const sendNotice = () => {
    setNotice({
      moveOut: tenancy.endsOn,
      reason: reasonId,
      note,
      sentAt: "Today",
    });
    setOfferState("declined");
    setSheet(false);
  };

  return (
    <>
      <PhoneTop>
        <PhoneTitle title="My lease" sub={`${tenancy.id} · Unit ${tenancy.unit} · ${tenancy.property}`} />
        <ToneChip tone={chip.tone} size="sm">
          {chip.label}
        </ToneChip>
      </PhoneTop>

      <PhoneBody>
        {currentOffer === "open" && !noticeOn ? (
          <Card className="gap-3 border-[1.5px] border-accent p-4">
            <View className="flex-row items-center justify-between gap-2">
              <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
                Renewal offer
              </Text>
              <ToneChip tone="warning" size="sm">
                {`Answer by ${offer.answerBy}`}
              </ToneChip>
            </View>
            <KeyValue
              items={[
                { label: "New term", value: offer.term },
                {
                  label: "Monthly rent",
                  value: (
                    <Text className="text-right text-[13px] leading-[18px] font-medium text-foreground">
                      {formatRwf(offer.rent)}{" "}
                      <Text className="font-normal text-muted">(now {formatNumber(offer.currentRent)})</Text>
                    </Text>
                  ),
                },
                { label: "Deposit top-up", value: formatRwf(offer.depositTopUp) },
                { label: "Other terms", value: offer.otherTerms },
              ]}
            />
            <View className="flex-row gap-2">
              <Button
                variant="secondary"
                size="lg"
                className="min-h-12 flex-1"
                onPress={() => setOfferState("declined")}
              >
                <Button.Label>Decline</Button.Label>
              </Button>
              <Button size="lg" className="min-h-12 flex-1" onPress={() => setOfferState("accepted")}>
                <Button.Label>Accept</Button.Label>
              </Button>
            </View>
            <Text className="text-xs leading-4 text-muted">
              Accepting sends you an amendment to sign. Nothing changes until both you and the landlord have signed.
            </Text>
          </Card>
        ) : null}

        {accepted ? (
          <StatusAlert
            status="accent"
            icon="Pencil"
            title="Renewal accepted · sign the amendment"
            description="We sent the amendment for your e-signature with a one-time code. Your lease is renewed only after both signatures."
          />
        ) : null}

        {currentOffer === "declined" && !noticeOn ? (
          <StatusAlert
            status="default"
            icon="CircleInfo"
            title="You declined the renewal"
            description={`Your lease ends on ${tenancy.endsOn}. Give notice below to confirm your move-out date.`}
          />
        ) : null}

        {currentNotice ? (
          <StatusAlert
            status="accent"
            icon="PaperPlane"
            title={`Notice sent · moving out ${currentNotice.moveOut}`}
            description="Waiting for management to acknowledge. You will be offered an inspection time."
          />
        ) : null}

        <Card className="gap-[10px] p-4">
          <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
            Lease summary
          </Text>
          <KeyValue
            items={[
              { label: "Term", value: tenancy.term },
              { label: "Rent", value: `${formatRwf(tenancy.rent)} monthly` },
              { label: "Due", value: tenancy.rentDue },
              { label: "Notice period", value: tenancy.noticePeriod },
              { label: "Caution held", value: formatRwf(tenancy.deposit) },
              { label: "Landlord", value: tenancy.landlord },
              { label: "Occupants", value: tenancy.occupants },
            ]}
          />
        </Card>

        <View className="gap-2">
          <SectionTitle>Documents</SectionTitle>
          <RowList
            label="Lease documents"
            rows={docs.map((doc) => ({
              id: doc.id,
              icon: doc.icon,
              title: doc.title,
              desc: doc.desc,
              chip: doc.state,
              tone: doc.tone,
            }))}
          />
        </View>

        <Card variant="secondary" className="gap-[10px] p-4">
          <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
            Moving out?
          </Text>
          <Text className="text-[13px] leading-[19px] text-muted">
            Give at least 30 days’ notice in writing. Notice sent here counts as written notice and is time-stamped.
          </Text>
          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onPress={() => setSheet(true)}
            isDisabled={noticeLocked}
          >
            <Icon name="ArrowRightFromSquare" />
            <Button.Label>Give notice</Button.Label>
          </Button>
          {noticeLocked ? (
            <Text className="text-xs leading-4 text-muted">
              {noticeOn
                ? "Notice already sent. Message management if your plans change."
                : "You accepted the renewal. Message management if your plans change."}
            </Text>
          ) : null}
        </Card>
      </PhoneBody>

      <PhoneSheet isOpen={sheet} onOpenChange={setSheet} heading="Give notice" onClose={() => setSheet(false)}>
        <TextField>
          <Label>Move-out date</Label>
          <Input accessibilityLabel="Move-out date" value={moveOutValue} onChangeText={setMoveOut} />
          <Description>
            Your lease ends {tenancy.endsShort}. The earliest date with 30 days’ notice is {tenancy.earliestMoveOut}.
          </Description>
        </TextField>
        <ChoiceField
          label="Reason"
          value={reasonId}
          onChange={setReason}
          options={reasons.map((item) => ({ id: item.id, label: item.label }))}
        />
        <TextField>
          <Label>Anything we should know? (optional)</Label>
          <TextArea
            accessibilityLabel="Anything we should know? (optional)"
            value={note}
            onChangeText={setNote}
            numberOfLines={2}
            style={{ height: 56 }}
          />
        </TextField>
        <View className="gap-2">
          <Text className="text-sm font-semibold text-foreground">What happens next</Text>
          <Timeline
            label="What happens next"
            items={steps.map((step) => ({
              id: step.id,
              title: step.title,
              detail: step.desc,
              marker: "idle" as const,
              icon: step.icon,
            }))}
          />
        </View>
        <Button size="lg" className="w-full" onPress={sendNotice}>
          <Button.Label>Send notice</Button.Label>
        </Button>
      </PhoneSheet>
    </>
  );
}
