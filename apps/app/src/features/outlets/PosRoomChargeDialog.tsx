"use client";

import { Ban, CircleCheck, CircleCheckFill, CircleXmarkFill, Key, Person, Xmark } from "@gravity-ui/icons";
import { Alert, Button, Checkbox, Modal } from "@heroui/react";
import { ItemCard, Segment } from "@heroui-pro/react";
import type { RoomChargeTarget } from "@injishi/data/fixtures/outlets";
import { useEffect, useState } from "react";

/**
 * Charge the open ticket to a room (artifact: the room dialog over the POS). The till checks the stay, the stay
 * policy and the waiter's permission before posting; blocked rooms explain why.
 */
export function PosRoomChargeDialog({
  isOpen,
  onOpenChange,
  total,
  targets,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ticket total, formatted. */
  total: string;
  targets: RoomChargeTarget[];
}) {
  const [room, setRoom] = useState(targets[0]?.id ?? "");
  const [signed, setSigned] = useState(false);
  const [posted, setPosted] = useState(false);
  const rm = targets.find((t) => t.id === room) ?? targets[0];

  // Every time the dialog opens it starts unsigned and unposted (the room choice is kept).
  useEffect(() => {
    if (isOpen) {
      setSigned(false);
      setPosted(false);
    }
  }, [isOpen]);

  const change = (open: boolean) => onOpenChange(open);

  if (!rm) return null;
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={change} className="h-full">
      <Modal.Container placement="top" className="h-full px-[16px] py-[40px] sm:w-full sm:px-[16px] sm:py-[40px]">
        <Modal.Dialog
          aria-labelledby="room-h"
          className="max-h-full gap-[14px] overflow-y-auto rounded-[24px] p-[24px] sm:max-w-[560px]"
        >
          <Modal.Header className="flex-row items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <Modal.Heading id="room-h" className="text-[20px] leading-[26px] font-semibold">
                Charge {total} to a room
              </Modal.Heading>
              <span className="text-[13px] text-muted">
                We check the stay, the stay policy and your permission before posting.
              </span>
            </div>
            <Button variant="ghost" isIconOnly aria-label="Close" onPress={() => change(false)}>
              <Xmark className="size-4" />
            </Button>
          </Modal.Header>

          <Modal.Body className="m-0 flex flex-col gap-[14px] p-0 text-[14px] text-foreground">
            <Segment
              aria-label="Room"
              selectedKey={rm.id}
              onSelectionChange={(k) => {
                setRoom(String(k));
                setSigned(false);
                setPosted(false);
              }}
              className="self-start"
            >
              {targets.map((t) => (
                <Segment.Item key={t.id} id={t.id}>
                  Room {t.room}
                </Segment.Item>
              ))}
            </Segment>

            <ItemCard variant="secondary">
              <ItemCard.Icon>
                <Person />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>{rm.guest}</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">{rm.stay}</ItemCard.Description>
              </ItemCard.Content>
            </ItemCard>

            <ul className="m-0 flex list-none flex-col gap-[8px] p-0" aria-label="Checks">
              {rm.checks.map((c) => (
                <li key={c.title} className="flex items-start gap-[10px]">
                  {c.ok ? (
                    <CircleCheckFill className="mt-[2px] size-4 shrink-0 text-success" aria-label="Passed" />
                  ) : (
                    <CircleXmarkFill className="mt-[2px] size-4 shrink-0 text-danger" aria-label="Failed" />
                  )}
                  <span className="flex flex-col">
                    <span className="font-medium">{c.title}</span>
                    <span className="text-[12px] leading-4 text-muted">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            {rm.allowed ? (
              <Checkbox isSelected={signed} onChange={setSigned} isDisabled={posted}>
                <Checkbox.Content className="gap-[8px]">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  Guest signed the bill and showed the room key
                </Checkbox.Content>
              </Checkbox>
            ) : null}

            {rm.block ? (
              <Alert status="danger" role="alert">
                <Alert.Indicator>
                  <Ban />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>{rm.block.title}</Alert.Title>
                  <Alert.Description>{rm.block.text}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            {posted && rm.posted ? (
              <Alert status="success" role="status">
                <Alert.Indicator>
                  <CircleCheck />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>{rm.posted.title}</Alert.Title>
                  <Alert.Description>{rm.posted.text}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </Modal.Body>

          <Modal.Footer className="mt-0 gap-[8px]">
            <Button variant="secondary" onPress={() => change(false)}>
              {posted ? "Done" : "Cancel"}
            </Button>
            <Button isDisabled={!rm.allowed || !signed || posted} onPress={() => setPosted(true)}>
              <Key className="size-4" />
              Post to folio
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
