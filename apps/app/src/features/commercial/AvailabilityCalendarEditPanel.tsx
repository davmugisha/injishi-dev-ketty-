"use client";

import { Xmark } from "@gravity-ui/icons";
import { Button, Description, Input, Label, ListBox, Popover, Select, TextField } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import type { AvailabilityCalendarReason } from "@injishi/product-pms";
import type { RefObject } from "react";

const SELL_OPTIONS = [
  { id: "open", label: "Open" },
  { id: "stop", label: "Stop-sell" },
];

/**
 * Anchored edit popover for the selected nights (artifact: the "ij-popover" under the selected row).
 * Non-modal: the grid stays usable while it is open, as on the board. It closes only through
 * Close, Cancel, Apply, Escape or a new pick in the grid.
 */
export function AvailabilityCalendarEditPanel({
  anchorRef,
  title,
  range,
  nightsLabel,
  hint,
  price,
  onPriceChange,
  stopSell,
  onStopSellChange,
  minStay,
  onMinStayChange,
  reasons,
  reasonId,
  onReasonChange,
  onClose,
  onApply,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  title: string;
  range: string;
  nightsLabel: string;
  hint: string;
  price: string;
  onPriceChange: (value: string) => void;
  stopSell: boolean;
  onStopSellChange: (value: boolean) => void;
  minStay: number;
  onMinStayChange: (value: number) => void;
  reasons: AvailabilityCalendarReason[];
  reasonId: string;
  onReasonChange: (id: string) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <Popover.Content
      triggerRef={anchorRef}
      isNonModal
      placement="bottom start"
      offset={4}
      className="w-[340px] max-w-[calc(100vw-32px)]"
    >
      <Popover.Dialog aria-labelledby="pop-h" className="p-[16px]">
        <div className="flex flex-col gap-[12px]">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <h3 id="pop-h" className="text-[15px] leading-[22px] font-semibold">
                {title}
              </h3>
              <span className="text-[12px] leading-4 text-muted tabular">{range}</span>
            </div>
            <Button size="sm" variant="ghost" isIconOnly aria-label="Close" onPress={onClose}>
              <Xmark className="size-4" />
            </Button>
          </div>

          <TextField value={price} onChange={onPriceChange} fullWidth className="gap-[4px]">
            <Label>Price override, BAR (RWF)</Label>
            <Input variant="secondary" inputMode="numeric" className="tabular" />
            <Description>{hint}</Description>
          </TextField>

          <div className="flex flex-col gap-[6px]">
            <span className="text-sm font-medium">Selling</span>
            <Segment
              aria-label="Open or close these nights"
              selectedKey={stopSell ? "stop" : "open"}
              onSelectionChange={(key) => onStopSellChange(key === "stop")}
              className="w-full"
            >
              {SELL_OPTIONS.map((o) => (
                <Segment.Item key={o.id} id={o.id} className="flex-1">
                  <Segment.Separator />
                  {o.label}
                </Segment.Item>
              ))}
            </Segment>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span id="pop-min" className="text-sm font-medium">
                Minimum stay
              </span>
              <span className="text-xs text-muted">Nights, counted from arrival</span>
            </span>
            <NumberStepper
              aria-labelledby="pop-min"
              value={minStay}
              minValue={1}
              maxValue={14}
              onChange={(v) => onMinStayChange(Number.isFinite(v) ? Math.min(14, Math.max(1, v)) : 1)}
            >
              <NumberStepper.Group>
                <NumberStepper.DecrementButton aria-label="One night fewer" />
                <NumberStepper.Value className="tabular" />
                <NumberStepper.IncrementButton aria-label="One night more" />
              </NumberStepper.Group>
            </NumberStepper>
          </div>

          <Select
            value={reasonId}
            onChange={(key) => {
              if (key != null && !Array.isArray(key)) onReasonChange(String(key));
            }}
            fullWidth
            variant="secondary"
            className="gap-[4px]"
          >
            <Label>Reason</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {reasons.map((r) => (
                  <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                    {r.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <p className="text-[12px] leading-4 text-muted">
            Goes to Direct web, Front desk, Marketplace and Booking.com. Confirmed bookings keep their stored rate.
          </p>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onPress={onClose}>
              Cancel
            </Button>
            <Button size="sm" onPress={onApply}>
              Apply to {nightsLabel}
            </Button>
          </div>
        </div>
      </Popover.Dialog>
    </Popover.Content>
  );
}
