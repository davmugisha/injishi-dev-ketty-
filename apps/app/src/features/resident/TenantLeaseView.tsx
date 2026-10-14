"use client";

import { ArrowRightFromSquare, CircleInfo, PaperPlane, Pencil, Xmark } from "@gravity-ui/icons";
import { Alert, Button, Card, Description, Input, Label, TextArea, TextField } from "@heroui/react";
import { ListView, NativeSelect, Timeline } from "@heroui-pro/react";
import type {
  LeaseDocument,
  MoveOutNotice,
  MoveOutStep,
  NoticeReason,
  RenewalOffer,
  Tenancy,
} from "@injishi/data/fixtures/resident";
import { formatNumber, formatRwf, Icon, KeyValueList, PhoneBody, PhoneTop } from "@injishi/ui";
import { useState } from "react";
import { PhoneSheet } from "@/components/phone/PhoneSheet";
import { ResidentTitle, renderSection, SectionTitle, ToneChip } from "./parts";

type OfferState = RenewalOffer["status"];

/** Lease summary, renewal offer, documents and move-out notice (artifact: TenantLease). */
export function TenantLeaseView({
  tenancy,
  offer,
  documents,
  steps,
  reasons,
}: {
  tenancy: Tenancy;
  offer: RenewalOffer;
  documents: LeaseDocument[];
  steps: MoveOutStep[];
  reasons: NoticeReason[];
}) {
  const [offerState, setOfferState] = useState<OfferState>(offer.status);
  const [notice, setNotice] = useState<MoveOutNotice | null>(tenancy.notice);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState(reasons[0]?.id ?? "");
  const [note, setNote] = useState("");

  const noticeOn = notice !== null;
  const accepted = offerState === "accepted";
  const noticeLocked = noticeOn || accepted;
  const chip = noticeOn
    ? { label: "Notice given", tone: "accent" as const }
    : accepted
      ? { label: "Renewing", tone: "info" as const }
      : { label: tenancy.status, tone: tenancy.statusTone };

  const docs: LeaseDocument[] = [
    ...(notice
      ? [
          {
            id: "notice-move-out",
            icon: "PaperPlane" as const,
            title: "Notice to move out",
            desc: `Sent today · move-out ${notice.moveOut}`,
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
      reason,
      note,
      sentAt: "Today",
    });
    setOfferState("declined");
    setSheet(false);
  };

  return (
    <>
      <PhoneTop>
        <ResidentTitle
          title="My lease"
          sub={`${tenancy.id} · Unit ${tenancy.unit} · ${tenancy.property}`}
          className="tabular"
        />
        <ToneChip tone={chip.tone} size="sm">
          {chip.label}
        </ToneChip>
      </PhoneTop>

      <PhoneBody>
        {offerState === "open" && !noticeOn ? (
          <Card
            render={renderSection}
            aria-labelledby="rn-h"
            className="gap-3 p-4 shadow-[inset_0_0_0_1.5px_var(--accent)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="rn-h" className="text-[15px] leading-[22px] font-semibold">
                Renewal offer
              </h2>
              <ToneChip tone="warning" size="sm">
                Answer by {offer.answerBy}
              </ToneChip>
            </div>
            <KeyValueList
              items={[
                { label: "New term", value: offer.term },
                {
                  label: "Monthly rent",
                  value: (
                    <span className="tabular">
                      {formatRwf(offer.rent)}{" "}
                      <span className="font-normal text-muted">(now {formatNumber(offer.currentRent)})</span>
                    </span>
                  ),
                },
                { label: "Deposit top-up", value: <span className="tabular">{formatRwf(offer.depositTopUp)}</span> },
                { label: "Other terms", value: offer.otherTerms },
              ]}
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" className="flex-1" onPress={() => setOfferState("declined")}>
                Decline
              </Button>
              <Button variant="primary" size="lg" className="flex-1" onPress={() => setOfferState("accepted")}>
                Accept
              </Button>
            </div>
            <span className="text-[12px] leading-4 text-muted">
              Accepting sends you an amendment to sign. Nothing changes until both you and the landlord have signed.
            </span>
          </Card>
        ) : null}

        {accepted ? (
          <Alert status="accent" role="status">
            <Alert.Indicator>
              <Pencil />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Renewal accepted · sign the amendment</Alert.Title>
              <Alert.Description>
                We sent the amendment for your e-signature with a one-time code. Your lease is renewed only after both
                signatures.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {offerState === "declined" && !noticeOn ? (
          <Alert status="default" role="status">
            <Alert.Indicator>
              <CircleInfo />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>You declined the renewal</Alert.Title>
              <Alert.Description>
                Your lease ends on {tenancy.endsOn}. Give notice below to confirm your move-out date.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {notice ? (
          <Alert status="accent" role="status">
            <Alert.Indicator>
              <PaperPlane />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Notice sent · moving out {notice.moveOut}</Alert.Title>
              <Alert.Description>
                Waiting for management to acknowledge. You will be offered an inspection time.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <Card render={renderSection} aria-labelledby="sm-h" className="gap-[10px] p-4">
          <h2 id="sm-h" className="text-[15px] leading-[22px] font-semibold">
            Lease summary
          </h2>
          <KeyValueList
            items={[
              { label: "Term", value: tenancy.term },
              { label: "Rent", value: <span className="tabular">{formatRwf(tenancy.rent)} monthly</span> },
              { label: "Due", value: tenancy.rentDue },
              { label: "Notice period", value: tenancy.noticePeriod },
              { label: "Caution held", value: <span className="tabular">{formatRwf(tenancy.deposit)}</span> },
              { label: "Landlord", value: tenancy.landlord },
              { label: "Occupants", value: tenancy.occupants },
            ]}
          />
        </Card>

        <section className="flex flex-col gap-2" aria-labelledby="dc-h">
          <SectionTitle id="dc-h">Documents</SectionTitle>
          <ListView aria-label="Lease documents">
            {docs.map((d) => (
              <ListView.Item key={d.id} id={d.id} textValue={d.title} className="items-start">
                <ListView.ItemContent className="items-start">
                  <Icon name={d.icon} className="mt-0.5 size-4 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title>{d.title}</ListView.Title>
                    <ListView.Description className="whitespace-normal">{d.desc}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <ToneChip tone={d.tone} size="sm">
                    {d.state}
                  </ToneChip>
                </ListView.ItemAction>
              </ListView.Item>
            ))}
          </ListView>
        </section>

        <Card render={renderSection} variant="secondary" aria-labelledby="gn-h" className="gap-[10px] p-4">
          <h2 id="gn-h" className="text-[15px] leading-[22px] font-semibold">
            Moving out?
          </h2>
          <p className="text-[13px] leading-[19px] text-muted">
            Give at least 30 days’ notice in writing. Notice sent here counts as written notice and is time-stamped.
          </p>
          <Button variant="secondary" size="lg" fullWidth onPress={() => setSheet(true)} isDisabled={noticeLocked}>
            <ArrowRightFromSquare className="size-4" />
            Give notice
          </Button>
          {noticeLocked ? (
            <span className="text-[12px] leading-4 text-muted">
              {noticeOn
                ? "Notice already sent. Message management if your plans change."
                : "You accepted the renewal. Message management if your plans change."}
            </span>
          ) : null}
        </Card>
      </PhoneBody>

      <PhoneSheet
        isOpen={sheet}
        onOpenChange={setSheet}
        heading={
          <span className="flex w-full items-center justify-between gap-2">
            <span>Give notice</span>
            <Button isIconOnly size="sm" variant="ghost" aria-label="Close" onPress={() => setSheet(false)}>
              <Xmark />
            </Button>
          </span>
        }
      >
        <TextField fullWidth defaultValue={tenancy.moveOutDefault} className="gap-1">
          <Label htmlFor="nt-date">Move-out date</Label>
          <Input id="nt-date" />
          <Description>
            Your lease ends {tenancy.endsShort}. The earliest date with 30 days’ notice is {tenancy.earliestMoveOut}.
          </Description>
        </TextField>
        <NativeSelect fullWidth className="flex flex-col gap-1">
          <Label>Reason</Label>
          <NativeSelect.Trigger value={reason} onChange={(event) => setReason(event.target.value)}>
            {reasons.map((r) => (
              <NativeSelect.Option key={r.id} value={r.id}>
                {r.label}
              </NativeSelect.Option>
            ))}
            <NativeSelect.Indicator />
          </NativeSelect.Trigger>
        </NativeSelect>
        <TextField fullWidth value={note} onChange={setNote} className="gap-1">
          <Label htmlFor="nt-note">Anything we should know? (optional)</Label>
          <TextArea id="nt-note" rows={2} />
        </TextField>
        <div className="flex flex-col gap-2">
          <h3 className="text-[14px] font-semibold">What happens next</h3>
          <Timeline size="sm" density="compact" aria-label="What happens next">
            {steps.map((step) => (
              <Timeline.Item key={step.id} status="default">
                <Timeline.Rail>
                  <Timeline.Marker>
                    <Icon name={step.icon} className="size-3.5" />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content className="flex flex-col">
                  <span className="text-[13px] font-medium">{step.title}</span>
                  <span className="text-[12px] leading-4 text-muted">{step.desc}</span>
                </Timeline.Content>
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
        <Button variant="primary" size="lg" fullWidth onPress={sendNotice}>
          Send notice
        </Button>
      </PhoneSheet>
    </>
  );
}
