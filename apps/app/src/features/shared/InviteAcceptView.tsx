"use client";

import {
  ArrowRight,
  ArrowRightToSquare,
  Ban,
  Check,
  CircleCheck,
  CircleInfo,
  CircleQuestion,
  EnvelopeOpen,
  PaperPlane,
  PersonsLock,
  ShieldKeyhole,
} from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Description, InputOTP, Label, TextArea, TextField } from "@heroui/react";
import { ItemCard, Navbar } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { Invitation, InvitationState, RoleScope } from "@injishi/data/fixtures/shared";
import { Icon, KeyValueList, LinkButton, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { CardHeading, IconNote, PublicBar } from "./ui";

type Phase = "review" | "otp" | "joined" | "decline" | "declined";

/** Accept invitation (artifact: InviteAccept.dc.html) — review a role before accepting it, then confirm the email. */
export function InviteAcceptView({
  invitation: inv,
  state,
  scope,
}: {
  invitation: Invitation;
  state: InvitationState;
  scope: RoleScope;
}) {
  const [phase, setPhase] = useState<Phase>("review");
  const [requested, setRequested] = useState(false);
  const [code, setCode] = useState("");
  const status = state.id;
  const valid = status === "valid";
  const showMessage = valid && (phase === "review" || phase === "otp");

  return (
    <>
      <PublicBar>
        <Navbar.Spacer />
        <LinkButton href={screenHref("PublicHelp")} variant="ghost" size="sm">
          <CircleQuestion className="size-4" />
          Help
        </LinkButton>
        <LinkButton href={screenHref("SignIn")} variant="ghost" size="sm">
          <ArrowRightToSquare className="size-4" />
          Sign in
        </LinkButton>
      </PublicBar>

      <main className="mx-auto flex w-full max-w-[1140px] flex-col gap-5 px-4 pt-6 pb-12 sm:px-8 sm:pb-[72px]">
        <PageHeader
          eyebrow={
            <>
              <EnvelopeOpen className="size-4" aria-hidden="true" />
              Invitation to join a team
            </>
          }
          title={`Join ${inv.group} as ${inv.role}`}
          description={`Hello ${inv.invitee}. Review what this role can and can’t do before you accept.`}
        />

        <div className="flex flex-wrap items-start gap-5">
          <Card
            render={(p) => <section {...p} />}
            aria-labelledby="inv-h"
            className="min-w-0 flex-[1.3_1_520px] gap-[18px] p-6"
          >
            <div className="flex items-start gap-3">
              <Avatar variant="soft" color="accent" className="size-10 shrink-0">
                <Avatar.Fallback>{inv.inviterInitials}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 id="inv-h" className="text-[15px] leading-[22px] font-semibold">
                  {inv.inviter} invited you
                </h2>
                <span className="text-[13px] text-muted">
                  {inv.inviterRole} · {inv.group} · {state.sentLine}
                </span>
              </div>
              <Chip variant="soft" color={toneColor(state.chipTone)} className="shrink-0">
                {state.chip}
              </Chip>
            </div>

            {state.banner ? (
              <Alert status={toneColor(state.banner.tone)} role="status">
                <Alert.Indicator>
                  <Icon name={state.banner.icon} />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>{state.banner.title}</Alert.Title>
                  <Alert.Description>{state.banner.body}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            <KeyValueList
              className={`rounded-[16px] bg-surface-secondary px-4 py-3.5 ${valid ? "" : "opacity-70"}`}
              items={[
                {
                  label: "Role",
                  value: (
                    <span className="flex flex-wrap items-center gap-2">
                      {inv.role}
                      {inv.roleProposed ? (
                        <Chip size="sm" variant="soft" color="warning">
                          Proposed role
                        </Chip>
                      ) : null}
                    </span>
                  ),
                },
                {
                  label: "Legal entity",
                  value: (
                    <>
                      {inv.entity} · <span className="tabular">TIN {inv.tin}</span>
                    </>
                  ),
                },
                { label: "Property", value: `${inv.property} · ${inv.propertyArea}` },
                { label: "Not included", value: <span className="font-normal">{inv.notIncluded}</span> },
                { label: "Sent to", value: inv.email },
                { label: state.expiryLabel, value: state.expiry },
              ]}
            />

            {showMessage ? (
              <blockquote className="m-0 py-0.5 pl-3.5 text-[14px] leading-[21px] shadow-[inset_2px_0_0_var(--accent)]">
                “{inv.message}”
                <span className="mt-1 block text-[12px] text-muted">Message from {inv.inviterFirstName}</span>
              </blockquote>
            ) : null}

            <Alert>
              <Alert.Indicator>
                <PersonsLock />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Your employee record doesn’t sign you in</Alert.Title>
                <Alert.Description>
                  {inv.entity} keeps an HR record for you as an employee. That record gives no access to Injishi. Access
                  comes only from this invitation, starts when you accept and confirm your email, and ends the moment it
                  is revoked.
                </Alert.Description>
              </Alert.Content>
            </Alert>

            {valid && phase === "review" ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Button onPress={() => setPhase("otp")}>
                    <Check className="size-4" />
                    Accept and confirm email
                  </Button>
                  <Button variant="secondary" onPress={() => setPhase("decline")}>
                    Decline
                  </Button>
                </div>
                <p className="text-[12px] leading-4 text-muted">
                  Accepting creates your Injishi sign-in for {inv.email} and adds the {inv.role} role at {inv.property}{" "}
                  only.
                </p>
              </div>
            ) : null}

            {valid && phase === "otp" ? (
              <div role="group" aria-labelledby="otp-l" className="flex flex-col gap-2.5">
                <Label id="otp-l" className="mb-0.5">
                  Enter the 6-digit code we sent to {inv.email}
                </Label>
                <InputOTP maxLength={6} value={code} onChange={setCode} variant="secondary" aria-labelledby="otp-l">
                  <InputOTP.Group>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTP.Slot key={i} index={i} className="h-[52px] w-12 text-xl font-semibold" />
                    ))}
                  </InputOTP.Group>
                </InputOTP>
                <span className="text-[12px] text-muted">Code expires in 10 minutes · Resend available in 0:51</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onPress={() => setPhase("joined")}>Confirm and join</Button>
                  <Button variant="ghost" onPress={() => setPhase("review")}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {valid && phase === "joined" ? (
              <>
                <Alert status="success" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>You’ve joined as {inv.role}</Alert.Title>
                    <Alert.Description>
                      Membership active for {inv.property} · email confirmed {inv.joinedAt} · recorded in Amahoro’s
                      audit log.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <ItemCard variant="secondary">
                  <ItemCard.Icon>
                    <ShieldKeyhole />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>Next: set up your authenticator app</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">
                      Finance actions such as refunds and fiscal settings ask for a code from it.
                    </ItemCard.Description>
                  </ItemCard.Content>
                </ItemCard>
                <div className="flex flex-wrap items-center gap-2">
                  <LinkButton href={screenHref(inv.workspace)}>
                    Open {inv.role} workspace
                    <ArrowRight className="size-4" />
                  </LinkButton>
                  <LinkButton href={screenHref("Account")} variant="secondary">
                    Set up authenticator
                  </LinkButton>
                </div>
              </>
            ) : null}

            {valid && phase === "decline" ? (
              <>
                <TextField className="flex flex-col gap-1">
                  <Label>Tell {inv.inviterFirstName} why (optional)</Label>
                  <TextArea
                    variant="secondary"
                    rows={3}
                    fullWidth
                    placeholder="For example: I start next month, please resend then."
                  />
                  <Description>
                    {inv.inviterFirstName} sees this note. Declining creates no access and keeps no data about you
                    beyond this decision.
                  </Description>
                </TextField>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="danger" onPress={() => setPhase("declined")}>
                    Decline invitation
                  </Button>
                  <Button variant="ghost" onPress={() => setPhase("review")}>
                    Go back
                  </Button>
                </div>
              </>
            ) : null}

            {valid && phase === "declined" ? (
              <>
                <Alert role="status">
                  <Alert.Indicator>
                    <CircleInfo />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>You declined this invitation</Alert.Title>
                    <Alert.Description>
                      {inv.inviter} has been told. No access was created. If you change your mind, ask him for a new
                      invitation.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <LinkButton href={screenHref("Main")} variant="secondary" className="self-start">
                  Go to Injishi
                </LinkButton>
              </>
            ) : null}

            {status === "expired" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button isDisabled aria-describedby="exp-why">
                    Accept
                  </Button>
                  {requested ? (
                    <Chip variant="soft" role="status">
                      <Check className="size-3" />
                      <Chip.Label>
                        Request sent to {inv.inviter} · {inv.requestSentAt}
                      </Chip.Label>
                    </Chip>
                  ) : (
                    <Button variant="secondary" onPress={() => setRequested(true)}>
                      <PaperPlane className="size-4" />
                      Ask {inv.inviterFirstName} for a new invitation
                    </Button>
                  )}
                </div>
                <p id="exp-why" className="text-[12px] text-muted">
                  Expired invitations can’t be accepted, so no access was created.
                </p>
              </>
            ) : null}

            {status === "revoked" ? (
              <LinkButton href={screenHref("Main")} variant="secondary" className="self-start">
                Go to Injishi
              </LinkButton>
            ) : null}

            {status === "accepted" ? (
              <div className="flex flex-wrap items-center gap-2">
                <LinkButton href={screenHref("SignIn")}>
                  <ArrowRightToSquare className="size-4" />
                  Sign in
                </LinkButton>
                <LinkButton href={screenHref("PublicHelp")} variant="ghost">
                  Trouble signing in?
                </LinkButton>
              </div>
            ) : null}
          </Card>

          <aside aria-label="What this role allows" className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
            {status === "revoked" ? (
              <Card variant="secondary" className="gap-2 p-5">
                <CardHeading>Nothing was shared</CardHeading>
                <p className="text-[13px] leading-[19px] text-muted">
                  A withdrawn invitation never created an account or membership. No business data was visible from this
                  link.
                </p>
              </Card>
            ) : (
              <>
                <Card render={(p) => <section {...p} />} aria-labelledby="can-h" className="gap-3 p-5">
                  <Card.Header>
                    <CardHeading id="can-h">What {scope.role} Can Do</CardHeading>
                    <Card.Description>{scope.where}</Card.Description>
                  </Card.Header>
                  <ul className="flex flex-col gap-2.5">
                    {scope.can.map((t) => (
                      <li key={t} className="flex items-start gap-2.5 text-[13px] leading-[19px]">
                        <CircleCheck className="mt-px size-4 shrink-0 text-success" aria-hidden="true" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card
                  variant="secondary"
                  render={(p) => <section {...p} />}
                  aria-labelledby="cant-h"
                  className="gap-3 p-5"
                >
                  <Card.Header>
                    <CardHeading id="cant-h">What {scope.role} Can’t Do</CardHeading>
                  </Card.Header>
                  <ul className="flex flex-col gap-2.5">
                    {scope.cant.map((t) => (
                      <li key={t} className="flex items-start gap-2.5 text-[13px] leading-[19px]">
                        <Ban className="mt-px size-4 shrink-0 text-muted" aria-hidden="true" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <IconNote icon={<CircleInfo />}>
                  {scope.role} is a newer role. {inv.inviterFirstName} can adjust exactly what it allows; each change is
                  recorded and you’ll be notified. Refunds above the limit and fiscal settings ask for an authenticator
                  code every time.
                </IconNote>
              </>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
