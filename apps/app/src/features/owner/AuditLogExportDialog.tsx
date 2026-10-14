"use client";

import { Button, Card, Description, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import type { AuditLogExportFormat } from "@injishi/data/fixtures/owner";
import { useState } from "react";

/**
 * "Export audit entries" dialog. The export needs a purpose (it may contain personal data) and a
 * step-up code; it is prepared in the background and recorded as an audit entry of its own.
 */
export function AuditLogExportDialog({
  isOpen,
  onOpenChange,
  scope,
  formats,
  onExport,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Last 7 days · all areas · all properties". */
  scope: string;
  formats: AuditLogExportFormat[];
  onExport: (format: AuditLogExportFormat["id"]) => void;
}) {
  const [format, setFormat] = useState<AuditLogExportFormat["id"]>("json");
  const [purpose, setPurpose] = useState("");
  const [code, setCode] = useState("");
  const ready = purpose.trim().length >= 5 && code.replace(/\D/g, "").length === 6;

  // Purpose and code never carry over to the next export; the chosen format does.
  const reset = () => {
    setPurpose("");
    setCode("");
  };
  const changeOpen = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };
  const submit = () => {
    onExport(format);
    reset();
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={changeOpen}>
      <Modal.Container>
        <Modal.Dialog aria-labelledby="exp-h" className="gap-4 sm:max-w-[520px]">
          <Modal.Header className="flex-col items-start gap-1">
            <Modal.Heading id="exp-h" className="text-lg leading-[26px] font-semibold">
              Export Audit Entries
            </Modal.Heading>
            <p className="text-sm text-muted">
              {scope}. The file may contain personal data, so the export is logged with your purpose.
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <RadioButtonGroup
              aria-label="Format"
              layout="grid"
              value={format}
              onChange={(v) => setFormat(v === "csv" ? "csv" : "json")}
              className="grid-cols-2 gap-2"
            >
              {formats.map((f) => (
                <RadioButtonGroup.Item key={f.id} value={f.id} className="px-3 py-2.5">
                  <RadioButtonGroup.Indicator />
                  <RadioButtonGroup.ItemContent className="gap-0.5">
                    <Label className="text-[13px] font-semibold">{f.title}</Label>
                    <Description className="text-xs leading-4">{f.description}</Description>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              ))}
            </RadioButtonGroup>

            <TextField value={purpose} onChange={setPurpose} className="gap-1">
              <Label>Purpose (required)</Label>
              <TextArea rows={2} placeholder="For example: annual review with our accountant" fullWidth />
            </TextField>

            <Card variant="secondary" className="gap-1.5 px-[14px] py-3">
              <TextField value={code} onChange={setCode} className="gap-1.5">
                <Label>Verify it’s you · code sent to +250 78• ••• 214</Label>
                <Input
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  className="max-w-[200px] tracking-[0.2em]"
                />
              </TextField>
            </Card>
          </Modal.Body>
          <Modal.Footer className="justify-end gap-2">
            <Button variant="secondary" slot="close">
              Cancel
            </Button>
            <Button isDisabled={!ready} onPress={submit}>
              Prepare export
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
