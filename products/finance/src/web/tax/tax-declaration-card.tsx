"use client";

import {
  ArrowDownToLine,
  Calendar,
  Check,
  CircleCheckFill,
  CircleDashed,
  Clock,
  Lock,
  PaperPlane,
  TriangleExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  type Key,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import { EmptyState, Stepper } from "@heroui-pro/react";
import { type ComponentType, type SVGProps, useState } from "react";
import type { FiscalProfile, VatDeclaration } from "../../model/accounting.ts";
import { CardHeading } from "../accounting-parts.tsx";

export type DeclarationStage = VatDeclaration["stage"];

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const LOG_ICON: Record<"ok" | "wait" | "current", { icon: IconComponent; className: string }> = {
  ok: { icon: CircleCheckFill, className: "text-success" },
  wait: { icon: CircleDashed, className: "text-muted" },
  current: { icon: Clock, className: "text-warning" },
};

/** Draft → reviewed → exported for filing. Injishi never files with RRA; the acknowledgement is typed in. */
export function TaxDeclarationCard({
  periodLabel,
  merchant,
  declaration,
  stage,
  onStageChange,
}: {
  periodLabel: string;
  merchant: FiscalProfile;
  /** The declaration for this merchant and period, or null when none can be prepared here. */
  declaration: VatDeclaration | null;
  stage: DeclarationStage;
  onStageChange: (stage: DeclarationStage) => void;
}) {
  const [requested, setRequested] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [ack, setAck] = useState("");
  const [ackSaved, setAckSaved] = useState("");
  const [format, setFormat] = useState<Key | null>("xlsx");

  const d = declaration;
  const done = stage === "draft" ? (requested ? 1 : 0) : stage === "reviewed" ? 2 : 3;

  const log: { kind: "ok" | "wait" | "current"; title: string; detail: string }[] = [];
  if (d) {
    log.push({
      kind: "ok",
      title: `Draft prepared by ${d.preparedBy}`,
      detail: `${d.prepared} · every ${periodLabel.split(" ")[0]} document Issued · rule versions recorded · working papers attached`,
    });
    if (stage === "draft")
      log.push(
        requested
          ? {
              kind: "current",
              title: `Review requested from ${d.reviewer}`,
              detail: "12 Oct 10:25 · you prepared it, so someone else reviews",
            }
          : { kind: "wait", title: "Review", detail: "Needs a person other than the preparer" },
      );
    else log.push({ kind: "ok", title: `Reviewed by ${d.reviewer}`, detail: `${d.reviewed} · “${d.reviewNote}”` });
    log.push(
      stage === "exported"
        ? {
            kind: "ok",
            title: `Exported for filing by ${d.preparedBy}`,
            detail: `12 Oct 10:26 · ${d.file} · checksum ${d.checksum}`,
          }
        : { kind: "wait", title: "Export for filing", detail: "Creates the file you or your tax agent submit to RRA" },
    );
    if (stage === "exported")
      log.push(
        ackSaved
          ? {
              kind: "ok",
              title: "RRA acknowledgement recorded by you",
              detail: `${ackSaved} · entered manually, not verified by Injishi`,
            }
          : {
              kind: "wait",
              title: "Filing on the RRA portal",
              detail: "Happens outside Injishi · record the acknowledgement here",
            },
      );
  }

  const action: { label: string; icon: IconComponent; onPress?: () => void; disabled: boolean; note: string } =
    stage === "draft"
      ? requested
        ? { label: "Review requested", icon: Clock, disabled: true, note: `Waiting for ${d?.reviewer ?? "a reviewer"}` }
        : {
            label: "Request review",
            icon: PaperPlane,
            onPress: () => setRequested(true),
            disabled: false,
            note: "A second person reviews before export",
          }
      : stage === "reviewed"
        ? {
            label: "Export for filing",
            icon: ArrowDownToLine,
            onPress: () => setDialog(true),
            disabled: false,
            note: "Produces a file. Nothing is sent to RRA.",
          }
        : {
            label: "Download again",
            icon: ArrowDownToLine,
            disabled: false,
            note: "Same file and checksum as the logged export",
          };
  const ActionIcon = action.icon;
  const isIkawa = merchant.id !== "ahl";
  const formats = d
    ? [
        { id: "xlsx", label: `Excel workbook · ${d.file}` },
        { id: "csv", label: `CSV files · ${d.file.replace(/\.xlsx$/, ".zip")}` },
      ]
    : [];

  return (
    <Card role="region" aria-labelledby="dec-h" className="gap-3.5 p-[18px]">
      <Card.Header>
        <CardHeading id="dec-h">Declaration Preparation · {periodLabel}</CardHeading>
        <Card.Description>Draft, review and export a file for filing. Injishi never files with RRA.</Card.Description>
      </Card.Header>
      {d ? (
        <>
          <Stepper size="sm" currentStep={done} aria-label="Declaration progress">
            {["Draft", "Reviewed", "Exported for filing"].map((t) => (
              <Stepper.Step key={t}>
                <Stepper.Indicator />
                <Stepper.Content>
                  <Stepper.Title>{t}</Stepper.Title>
                </Stepper.Content>
                <Stepper.Separator />
              </Stepper.Step>
            ))}
          </Stepper>
          <ul className="flex flex-col gap-2">
            {log.map((c) => {
              const ic = LOG_ICON[c.kind];
              const LogIcon = ic.icon;
              return (
                <li key={c.title} className="flex items-start gap-2.5">
                  <LogIcon className={`mt-0.5 size-4 flex-none ${ic.className}`} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13px] font-medium">{c.title}</span>
                    <span className="text-xs leading-4 text-muted">{c.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {stage === "exported" ? (
            <Card variant="secondary" className="gap-2.5 p-3.5">
              <TextField value={ack} onChange={setAck} fullWidth>
                <Label>RRA acknowledgement reference</Label>
                <Input className="tabular" placeholder="As shown on the RRA portal after you file" />
                <Description>Recorded as you enter it. Injishi cannot check it with RRA.</Description>
              </TextField>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" isDisabled={!ack.trim()} onPress={() => setAckSaved(ack.trim())}>
                  Record acknowledgement
                </Button>
                <Chip size="sm" variant="soft" color={ackSaved ? "default" : "warning"}>
                  {ackSaved ? "Filed · recorded by you" : "Not filed yet"}
                </Chip>
              </div>
            </Card>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" isDisabled={action.disabled} onPress={action.onPress}>
              <ActionIcon className="size-4" aria-hidden="true" />
              {action.label}
            </Button>
            {stage === "reviewed" ? (
              <Button
                size="sm"
                variant="ghost"
                onPress={() => {
                  setRequested(false);
                  onStageChange("draft");
                }}
              >
                Return to draft
              </Button>
            ) : null}
            <span className="text-xs text-muted">{action.note}</span>
          </div>
        </>
      ) : (
        <EmptyState size="sm">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">{isIkawa ? <Lock /> : <Calendar />}</EmptyState.Media>
            <EmptyState.Title>
              {isIkawa ? `Prepared by ${merchant.name}` : "Opens after October closes"}
            </EmptyState.Title>
            <EmptyState.Description>
              {isIkawa
                ? `${merchant.name} files its own declaration. Your delegated access covers fiscal support only, so you can view these figures but not prepare or export them.`
                : "A declaration is prepared from a closed period. October closes after the last fiscal day and the period-close checks."}
            </EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      )}

      {d ? (
        <Modal.Backdrop isOpen={dialog} onOpenChange={setDialog}>
          <Modal.Container>
            <Modal.Dialog aria-labelledby="ex-h" className="sm:max-w-[520px]">
              <Modal.Header className="flex-col items-start gap-1">
                <Modal.Heading id="ex-h" className="text-lg leading-[26px] font-semibold">
                  Export {periodLabel} for Filing
                </Modal.Heading>
                <p className="text-[13px] text-muted">
                  {merchant.name} · {merchant.tin} · reviewed by {d.reviewer}
                </p>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <ul className="flex flex-col gap-1.5 text-[13px]">
                  {[
                    "Output VAT by treatment, with rule versions",
                    `${d.documents.toLocaleString("en-KE")} fiscal documents with their numbers`,
                    `${d.supplierInvoices.toLocaleString("en-KE")} supplier fiscal invoices behind input VAT`,
                  ].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="size-4 flex-none" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                <Select fullWidth value={format} onChange={(v) => setFormat(v as Key | null)}>
                  <Label>Format</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {formats.map((f) => (
                        <ListBox.Item key={f.id} id={f.id} textValue={f.label}>
                          {f.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Alert status="warning">
                  <Alert.Indicator>
                    <TriangleExclamation />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>This does not file anything</Alert.Title>
                    <Alert.Description>
                      You or your tax agent submit the declaration on the RRA portal. The export is logged with your
                      name and a checksum.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onPress={() => {
                    setDialog(false);
                    onStageChange("exported");
                  }}
                >
                  <ArrowDownToLine className="size-4" aria-hidden="true" />
                  Export file
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      ) : null}
    </Card>
  );
}
