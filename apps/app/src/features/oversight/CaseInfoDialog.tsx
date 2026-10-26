"use client";

import { PaperPlane } from "@gravity-ui/icons";
import { Button, Checkbox, CheckboxGroup, Description, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import type { CaseFile } from "@injishi/data/fixtures/oversight";
import { useState } from "react";

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
  const [needs, setNeeds] = useState<string[]>(() => file.infoNeeds.filter((n) => n.suggested).map((n) => n.id));
  const [message, setMessage] = useState(file.infoMessage);
  const [due, setDue] = useState(file.infoDue);
  const canSend = needs.length > 0 && message.trim().length > 0 && due.trim().length > 0;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog aria-labelledby="info-h" className="sm:max-w-[520px]">
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="flex flex-col items-start gap-1">
            <Modal.Heading id="info-h" className="text-lg leading-[26px] font-semibold">
              Request More Information
            </Modal.Heading>
            <p className="text-[13px] leading-[18px] text-muted">
              The owner is notified in Injishi and by SMS. Your SLA clock pauses until they reply.
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <CheckboxGroup value={needs} onChange={setNeeds} className="gap-2">
              <Label>What is needed</Label>
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
              <Label>Message to the business</Label>
              <TextArea rows={4} />
            </TextField>
            <TextField fullWidth value={due} onChange={setDue} className="gap-1">
              <Label>Response due</Label>
              <Input />
              <Description>10 working days. Reminders go out 5 and 2 days before.</Description>
            </TextField>
          </Modal.Body>
          <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onPress={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button isDisabled={!canSend} onPress={onSend}>
              <PaperPlane className="size-4" />
              Send request
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
