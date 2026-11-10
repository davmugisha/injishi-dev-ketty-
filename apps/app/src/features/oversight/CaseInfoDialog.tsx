"use client";

import { PaperPlane } from "@gravity-ui/icons";
import { Button, Checkbox, CheckboxGroup, Description, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import type { CaseFile } from "@injishi/data/fixtures/oversight";
import { useState } from "react";
import { useTranslations } from "next-intl";

/** Request more information from the business: what is needed, the message and the response date. */
export function CaseInfoDialog({
  file,
  isOpen,
  onOpenChange,
  onSend,
}: {
  file: CaseFile;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: () => void;
}) {
  const t = useTranslations("officialInfoDialog");
  const [needs, setNeeds] = useState<string[]>(() => file.infoNeeds.filter((n) => n.suggested).map((n) => n.id));
  const [message, setMessage] = useState(file.infoMessage);
  const [due, setDue] = useState(file.infoDue);
  const canSend = needs.length > 0 && message.trim().length > 0 && due.trim().length > 0;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog aria-labelledby="info-h" className="sm:max-w-[520px]">
          <Modal.CloseTrigger aria-label={t("close")} />
          <Modal.Header className="flex flex-col items-start gap-1">
            <Modal.Heading id="info-h" className="text-lg leading-[26px] font-semibold">
              {t("title")}
            </Modal.Heading>
            <p className="text-[13px] leading-[18px] text-muted">
              {t("intro")}
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <CheckboxGroup value={needs} onChange={setNeeds} className="gap-2">
              <Label>{t("whatNeeded")}</Label>
              {file.infoNeeds.map((n) => (
                <Checkbox key={n.id} value={n.id}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {n.label}
                  </Checkbox.Content>
                </Checkbox>
              ))}
            </CheckboxGroup>
            <TextField fullWidth value={message} onChange={setMessage} className="gap-1">
              <Label>{t("message")}</Label>
              <TextArea rows={4} />
            </TextField>
            <TextField fullWidth value={due} onChange={setDue} className="gap-1">
              <Label>{t("responseDue")}</Label>
              <Input />
              <Description>{t("dueHint")}</Description>
            </TextField>
          </Modal.Body>
          <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onPress={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button isDisabled={!canSend} onPress={onSend}>
              <PaperPlane className="size-4" />
              {t("send")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
