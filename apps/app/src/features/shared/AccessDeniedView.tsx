"use client";

import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronRight,
  CircleCheck,
  Link as LinkIcon,
  PaperPlane,
  ShieldCheck,
  ShieldKeyhole,
  Xmark,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Chip,
  Description,
  Input,
  Label,
  Modal,
  Radio,
  RadioGroup,
  Separator,
  Table,
  TextArea,
  TextField,
} from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import { type Persona, type ScreenProduct, screenHref } from "@injishi/data";
import type {
  AccessAlternatives,
  AccessDenial,
  DataExport,
  ExportPurpose,
  ExportRecord,
} from "@injishi/data/fixtures/shared";
import { formatNumber, Icon, KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { ChoiceSelect, IconTile } from "./ui";

interface AccessDeniedData {
  denial: AccessDenial;
  alternatives: AccessAlternatives;
  dataExport: DataExport;
  purposes: ExportPurpose[];
  history: ExportRecord[];
}

function placeName(persona: Persona): string {
  const ws = persona.workspace;
  const branch = ws?.branches.find((b) => b.id === ws.currentBranch);
  return branch?.name ?? persona.org;
}

/** What each product is called, for the sentence that names one switched off. */
const PRODUCT_NAME: Record<ScreenProduct, string> = {
  account: "Account",
  marketplace: "Marketplace",
  pms: "PMS",
  outlets: "Outlets",
  pos: "POS",
  residence: "Residence",
  hr: "HR",
  finance: "Finance",
  pay: "Pay",
};

/** The layer that refused (ADR-076 G14): it decides what the card says, never the request button. */
export type DeniedLayer = "workspace" | "operational" | "entitlement" | "permission";

/** Permission denial and export step-up (artifact: AccessDenied.dc.html). Default is the denied card. */
export function AccessDeniedView({
  persona,
  variant,
  layer = "permission",
  product,
  data,
}: {
  persona: Persona;
  variant: "denied" | "stepup";
  layer?: DeniedLayer;
  product?: ScreenProduct;
  data: AccessDeniedData;
}) {
  const { denial, alternatives, dataExport: exp, purposes, history } = data;
  const place = placeName(persona);
  const decider = denial.decider.split(",")[0]?.trim() || denial.decider;
  const noun = denial.noun.charAt(0).toUpperCase() + denial.noun.slice(1);
  const [req, setReq] = useState<"idle" | "form" | "sent">("idle");
  const [why, setWhy] = useState(denial.reason);
  const [duration, setDuration] = useState(denial.durations[0] ?? "Today only");
  const [open, setOpen] = useState(variant === "stepup");
  const [purpose, setPurpose] = useState(purposes.find((p) => p.id === "audit")?.id ?? purposes[0]?.id ?? "audit");
  const [reason, setReason] = useState(exp.reason);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const digits = code.replace(/\D/g, "").length;
  const purposeLabel = (purposes.find((p) => p.id === purpose)?.label ?? "Internal audit").toLowerCase();
  const home = screenHref(persona.home);

  return (
    <PageContent>
      {variant === "denied" ? (
        <div className="flex justify-center py-6">
          <section
            aria-labelledby="ad-h"
            className="flex w-full max-w-[660px] flex-col gap-[18px] rounded-2xl bg-surface p-8 shadow-surface"
          >
            <p className="flex items-center gap-1.5 text-[13px] leading-[18px] font-medium text-muted">
              <LinkIcon className="size-3.5" aria-hidden="true" />
              {denial.source} · {denial.crumb}
            </p>
            <div className="flex items-start gap-4">
              <IconTile icon={<ShieldKeyhole className="size-[22px]" />} size={48} />
              <div className="flex flex-col gap-1.5">
                <h1 id="ad-h" className="text-2xl leading-8 font-semibold tracking-[-0.015em]">
                  {layer === "entitlement"
                    ? "This Product Isn’t Switched On Here"
                    : layer === "operational"
                      ? "Your Business Isn’t Active Yet"
                      : layer === "workspace"
                        ? `This ${noun} Belongs to Another Kind of Account`
                        : `This ${noun} Isn’t Part of Your Role`}
                </h1>
                <p className="text-sm text-muted">
                  {layer === "entitlement"
                    ? `${product ? PRODUCT_NAME[product] : "This product"} is not switched on at ${place}, so nothing from this ${denial.noun} was loaded. Injishi switches a product on for a business; its owner can ask.`
                    : layer === "operational"
                      ? `${place} is still in registration. Its screens open once Injishi approves it.`
                      : layer === "workspace"
                        ? `This ${denial.noun} is for a different kind of account than the ones you hold, so nothing from it was loaded.`
                        : `Your ${persona.role} role at ${place} doesn’t include ${denial.scope}, so nothing from this ${denial.noun} was loaded.`}
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-surface-secondary px-4 py-3.5">
              <KeyValueList
                items={[
                  { label: "Who can open it", value: denial.whoCanOpen },
                  { label: "Who decides access", value: denial.decider },
                  { label: "Your role", value: `${persona.role} · ${place}` },
                ]}
              />
            </div>

            {req === "idle" ? (
              <div className="flex flex-wrap gap-2">
                <Button onPress={() => setReq("form")}>
                  <PaperPlane className="size-4" />
                  Request access
                </Button>
                <LinkButton href={home} variant="secondary">
                  <ArrowLeft className="size-4" />
                  Back to Today
                </LinkButton>
              </div>
            ) : null}

            {req === "form" ? (
              <div className="flex flex-col gap-3 rounded-2xl p-4 shadow-[inset_0_0_0_1px_var(--separator)]">
                <TextField fullWidth value={why} onChange={setWhy} className="gap-1">
                  <Label htmlFor="ra-why">What do you need it for?</Label>
                  <TextArea id="ra-why" rows={3} />
                </TextField>
                <ChoiceSelect
                  id="ra-for"
                  label="For how long"
                  options={denial.durations}
                  value={duration}
                  onChange={setDuration}
                  className="max-w-[260px]"
                />
                <p className="text-xs leading-[17px] text-muted">
                  Goes to {decider}. Any change to your access is recorded in the audit log, and it ends when the time
                  you chose runs out.
                </p>
                <div className="flex gap-2">
                  <Button onPress={() => setReq("sent")}>Send request</Button>
                  <Button variant="ghost" onPress={() => setReq("idle")}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {req === "sent" ? (
              <>
                <Alert status="default" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>
                      Request sent to {decider} · {denial.requestSentAt}
                    </Alert.Title>
                    <Alert.Description>
                      You’ll get a notification when he decides. Nothing changes until then.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <LinkButton href={home} variant="secondary" className="self-start">
                  <ArrowLeft className="size-4" />
                  Back to Today
                </LinkButton>
              </>
            ) : null}

            <Separator />
            <div className="flex flex-col gap-2">
              <h2 className="text-[15px] leading-[22px] font-semibold">{alternatives.heading}</h2>
              <ListView variant="secondary" aria-label={alternatives.heading} items={alternatives.items}>
                {(c) => (
                  <ListView.Item id={c.id} textValue={c.title} href={screenHref(c.board)}>
                    <ListView.ItemContent>
                      <Icon name={c.icon} className="size-4 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title className="whitespace-normal">{c.title}</ListView.Title>
                        <ListView.Description className="whitespace-normal">{c.desc}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <ChevronRight className="size-4 text-muted" />
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
            </div>
            <p className="text-xs text-muted tabular">
              Reference {denial.reference} · {denial.at} · blocked attempts are recorded in the audit log
            </p>
          </section>
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow={exp.crumb}
            title={exp.title}
            description={exp.lead}
            actions={
              <Button
                onPress={() => {
                  setOpen(true);
                  setVerified(false);
                  setCode("");
                }}
              >
                <ArrowDownToLine className="size-4" />
                Export guest data
              </Button>
            }
          />
          <section
            aria-label="Export settings"
            className="flex flex-col gap-3.5 rounded-2xl bg-surface p-5 shadow-surface"
          >
            <KeyValueList
              items={[
                { label: "Property", value: `${exp.property} · ${exp.entity}` },
                { label: "Stay dates", value: exp.dates },
                { label: "Rows", value: <span className="tabular">{formatNumber(exp.rows)} guests</span> },
                { label: "Format", value: exp.format },
              ]}
            />
            <div className="flex flex-wrap gap-1.5">
              {exp.fields.map((f) => (
                <Chip key={f} size="sm" variant="soft">
                  <Chip.Label>{f}</Chip.Label>
                </Chip>
              ))}
              <Chip size="sm" variant="soft" color="warning">
                <Chip.Label>Contains personal data</Chip.Label>
              </Chip>
            </div>
          </section>
          <section aria-labelledby="prev-h" className="flex flex-col gap-2.5 rounded-2xl bg-surface-secondary p-5">
            <h2 id="prev-h" className="text-[15px] leading-[22px] font-semibold">
              Earlier Exports
            </h2>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Earlier exports">
                  <Table.Header>
                    <Table.Column isRowHeader>Export</Table.Column>
                    <Table.Column>By</Table.Column>
                    <Table.Column>Purpose</Table.Column>
                    <Table.Column className="text-right">Rows</Table.Column>
                    <Table.Column>Link</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {history.map((row) => (
                      <Table.Row key={row.id} id={row.id}>
                        <Table.Cell className="tabular">{row.label}</Table.Cell>
                        <Table.Cell>{row.by}</Table.Cell>
                        <Table.Cell>{row.purpose}</Table.Cell>
                        <Table.Cell className="text-right tabular">{formatNumber(row.rows)}</Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft">
                            <Chip.Label>{row.link}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </section>
          <Modal.Backdrop isOpen={open} onOpenChange={setOpen}>
            <Modal.Container size="lg" placement="center">
              <Modal.Dialog aria-labelledby="su-h" className="gap-4 sm:max-w-[580px]">
                <div className="flex items-start gap-3">
                  <IconTile icon={<ShieldKeyhole className="size-5" />} tone="accent" size={40} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 id="su-h" className="text-[17px] leading-6 font-semibold">
                      Confirm It’s You to Export Guest Data
                    </h2>
                    <p className="text-[13px] leading-[18px] text-muted">
                      Personal data exports always ask for a fresh authenticator code, a purpose and a reason.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    aria-label="Cancel export"
                    onPress={() => setOpen(false)}
                  >
                    <Xmark className="size-4" />
                  </Button>
                </div>
                {verified ? (
                  <>
                    <Alert status="success" role="status">
                      <Alert.Indicator>
                        <CircleCheck />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Export ready</Alert.Title>
                        <Alert.Description>
                          Code accepted at {exp.verifiedAt}. The file was prepared for {purposeLabel}.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                    <div className="rounded-[14px] bg-surface-secondary px-3.5 py-3">
                      <KeyValueList
                        items={[
                          {
                            label: "Export",
                            value: (
                              <span className="tabular">
                                {exp.exportId} · {formatNumber(exp.rows)} rows
                              </span>
                            ),
                          },
                          { label: "Fingerprint", value: <span className="tabular">{exp.fingerprint}</span> },
                          { label: "Link expires", value: exp.linkExpires },
                          { label: "Audit entry", value: <span className="tabular">{exp.auditEntry}</span> },
                        ]}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <LinkButton href={screenHref("AuditLog")} variant="secondary">
                        View in audit log
                      </LinkButton>
                      <Button>
                        <ArrowDownToLine className="size-4" />
                        Download CSV
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5 rounded-[14px] bg-surface-secondary px-3.5 py-3">
                      <span className="text-[13px] font-semibold">
                        Guest register · {exp.property} · {exp.dates}
                      </span>
                      <span className="text-xs text-muted">
                        {formatNumber(exp.rows)} guests · name, nationality, ID or passport number, phone, email, stay
                        dates
                      </span>
                    </div>
                    <RadioGroup aria-label="Purpose" value={purpose} onChange={setPurpose} className="gap-2">
                      <Label>Purpose</Label>
                      {purposes.map((p) => (
                        <Radio key={p.id} value={p.id}>
                          <Radio.Content className="items-start">
                            <Radio.Control>
                              <Radio.Indicator />
                            </Radio.Control>
                            <span className="flex flex-col">
                              <span>{p.label}</span>
                              <span className="text-[13px] text-muted">{p.desc}</span>
                            </span>
                          </Radio.Content>
                        </Radio>
                      ))}
                    </RadioGroup>
                    <TextField fullWidth value={reason} onChange={setReason} className="gap-1">
                      <Label htmlFor="su-why">Reason for the audit log</Label>
                      <TextArea id="su-why" rows={2} />
                    </TextField>
                    <TextField fullWidth value={code} onChange={setCode} className="gap-1">
                      <Label htmlFor="su-code">Authenticator code</Label>
                      <Input
                        id="su-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000 000"
                        className="text-lg tracking-[0.3em]"
                      />
                      <Description>From the authenticator app on your phone · changes every 30 seconds</Description>
                    </TextField>
                    <Alert status="default">
                      <Alert.Indicator>
                        <ShieldCheck />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Recorded in the audit log</Alert.Title>
                        <Alert.Description>
                          Your name, purpose, reason, time, row count and a file fingerprint. The download link works
                          for 24 hours and only for you.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="min-w-[200px] flex-1 text-xs text-muted">
                        {digits < 6
                          ? "Enter the 6-digit code to continue."
                          : "Ready. The code is checked before anything is prepared."}
                      </span>
                      <Button variant="ghost" onPress={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button isDisabled={digits < 6} onPress={() => setVerified(true)}>
                        Verify and export
                      </Button>
                    </div>
                  </>
                )}
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </>
      )}
    </PageContent>
  );
}
