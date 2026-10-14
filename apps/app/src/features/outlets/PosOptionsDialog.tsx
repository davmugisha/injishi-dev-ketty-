"use client";

import { Boxes3, CircleCheckFill, Plus, Xmark } from "@gravity-ui/icons";
import { Button, Checkbox, Chip, Label, Modal, TextArea, ToggleButton } from "@heroui/react";
import { RadioButtonGroup, Segment } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import type { MenuItem, MenuOption } from "@injishi/data/fixtures/outlets";
import { money, plus } from "./shared";

/** Choices being made in the options dialog (artifact state: side, spice, extras, note, allergy, qty). */
export interface OptionChoices {
  side: string;
  spice: string;
  extras: string[];
  note: string;
  allergy: boolean;
  qty: number;
}

/** Most portions of one dish a single line can carry. */
const MAX_QTY = 4;

const groupOf = (item: MenuItem, id: "side" | "spice" | "extras"): MenuOption[] =>
  item.optionGroups?.find((g) => g.id === id)?.options ?? [];

/** Unit price with the chosen side and extras. */
export function optionsUnitPrice(item: MenuItem, c: OptionChoices): number {
  const side = groupOf(item, "side").find((o) => o.id === c.side)?.price ?? 0;
  const extras = groupOf(item, "extras")
    .filter((o) => c.extras.includes(o.id))
    .reduce((a, o) => a + o.price, 0);
  return item.price + side + extras;
}

/** "Fried plantain · Medium spice · pili pili sauce" — how the line reads on the ticket and in the kitchen. */
export function optionsSummary(item: MenuItem, c: OptionChoices): string {
  const side = groupOf(item, "side").find((o) => o.id === c.side)?.label;
  const spice = groupOf(item, "spice").find((o) => o.id === c.spice)?.label;
  const extras = groupOf(item, "extras")
    .filter((o) => c.extras.includes(o.id))
    .map((o) => o.short ?? o.label);
  return [side, spice ? `${spice} spice` : null, ...extras].filter(Boolean).join(" · ");
}

/** Options dialog for a dish with choices (artifact: the Grilled tilapia dialog over the POS). */
export function PosOptionsDialog({
  item,
  isOpen,
  onOpenChange,
  choices,
  onChange,
  seatLabel,
  onAdd,
}: {
  item: MenuItem;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  choices: OptionChoices;
  onChange: (patch: Partial<OptionChoices>) => void;
  seatLabel: string;
  onAdd: () => void;
}) {
  const sides = groupOf(item, "side");
  const spices = groupOf(item, "spice");
  const extras = groupOf(item, "extras");
  const total = optionsUnitPrice(item, choices) * choices.qty;
  const meta = [item.description, money(item.price), item.station].filter(Boolean).join(" · ");

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} className="h-full">
      <Modal.Container placement="top" className="h-full px-[16px] py-[20px] sm:w-full sm:px-[16px] sm:py-[20px]">
        <Modal.Dialog
          aria-labelledby="mod-h"
          className="max-h-full gap-[14px] overflow-y-auto rounded-[24px] p-[24px] sm:max-w-[720px]"
        >
          <Modal.Header className="flex-row items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <Modal.Heading id="mod-h" className="text-[20px] leading-[26px] font-semibold">
                {item.name}
              </Modal.Heading>
              <span className="text-[13px] text-muted tabular">{meta}</span>
            </div>
            {item.portionsLeft ? (
              <Chip color="warning" variant="soft">
                <Boxes3 className="size-3" />
                <Chip.Label>{item.portionsLeft} portions left</Chip.Label>
              </Chip>
            ) : null}
            <Button variant="ghost" isIconOnly aria-label="Close options" onPress={() => onOpenChange(false)}>
              <Xmark className="size-4" />
            </Button>
          </Modal.Header>

          <Modal.Body className="m-0 flex flex-col gap-[14px] p-0 text-[14px] text-foreground">
            <RadioButtonGroup
              layout="grid"
              variant="secondary"
              value={choices.side}
              onChange={(v) => v && onChange({ side: v })}
              className="grid-cols-4 gap-[8px]"
            >
              <Label className="col-span-full">Side · choose one (required)</Label>
              {sides.map((o) => (
                <RadioButtonGroup.Item key={o.id} value={o.id} className="gap-[2px] px-[14px] py-[12px]">
                  <RadioButtonGroup.Indicator className="top-[12px] right-[12px]">
                    <CircleCheckFill />
                  </RadioButtonGroup.Indicator>
                  <RadioButtonGroup.ItemContent>
                    <Label className="font-semibold">{o.label}</Label>
                    <span className="text-[12px] text-muted tabular">
                      {o.price ? `+ ${money(o.price)}` : "Included"}
                    </span>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              ))}
            </RadioButtonGroup>

            <div className="grid grid-cols-2 gap-[14px]">
              <div className="flex flex-col gap-[6px]">
                <Label id="spice-l">Spice</Label>
                <Segment
                  aria-labelledby="spice-l"
                  selectedKey={choices.spice}
                  onSelectionChange={(k) => onChange({ spice: String(k) })}
                  className="w-full"
                >
                  {spices.map((o) => (
                    <Segment.Item key={o.id} id={o.id}>
                      {o.label}
                    </Segment.Item>
                  ))}
                </Segment>
              </div>
              <div className="flex flex-col gap-[6px]">
                <Label id="extras-l">Extras</Label>
                <div role="group" aria-labelledby="extras-l" className="flex flex-wrap gap-[6px]">
                  {extras.map((o) => (
                    <ToggleButton
                      key={o.id}
                      size="sm"
                      isSelected={choices.extras.includes(o.id)}
                      onChange={(on) =>
                        onChange({
                          extras: on ? [...choices.extras, o.id] : choices.extras.filter((x) => x !== o.id),
                        })
                      }
                    >
                      {o.price ? `${o.label} ${plus(o.price)}` : o.label}
                    </ToggleButton>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="allergy">Allergy or kitchen note</Label>
              <TextArea
                id="allergy"
                rows={2}
                fullWidth
                variant="secondary"
                value={choices.note}
                onChange={(e) => onChange({ note: e.target.value })}
              />
              <Checkbox isSelected={choices.allergy} onChange={(on) => onChange({ allergy: on })}>
                <Checkbox.Content className="gap-[8px]">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  This is an allergy · shows as an allergy alert on the kitchen display
                </Checkbox.Content>
              </Checkbox>
            </div>
          </Modal.Body>

          <Modal.Footer className="mt-0 flex-wrap justify-start gap-[14px] border-t border-separator pt-[4px]">
            <div className="flex items-center gap-[8px] pt-[10px]">
              <Label>Seat</Label>
              <Chip color="accent" variant="soft">
                {seatLabel}
              </Chip>
            </div>
            <div className="flex items-center gap-[8px] pt-[10px]">
              <Label id="qty-l">Quantity</Label>
              <NumberStepper
                aria-labelledby="qty-l"
                value={choices.qty}
                minValue={1}
                maxValue={MAX_QTY}
                onChange={(v) => onChange({ qty: Number.isNaN(v) ? 1 : v })}
              >
                <NumberStepper.Group>
                  <NumberStepper.DecrementButton aria-label="Decrease quantity" />
                  <NumberStepper.Value className="min-w-8 tabular" />
                  <NumberStepper.IncrementButton aria-label="Increase quantity" />
                </NumberStepper.Group>
              </NumberStepper>
            </div>
            <span className="flex-1" />
            <div className="flex gap-[8px] pt-[10px]">
              <Button variant="secondary" size="lg" onPress={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="lg" onPress={onAdd}>
                <Plus className="size-4" />
                Add to ticket · {money(total)}
              </Button>
            </div>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
