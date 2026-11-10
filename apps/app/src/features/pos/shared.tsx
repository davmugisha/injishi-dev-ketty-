"use client";

import { CircleInfo, Xmark } from "@gravity-ui/icons";
import { Alert, Button, Chip, Modal, toast } from "@heroui/react";
import { formatRwf } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import type { OrderStatus, TableStatus, TicketStatus } from "@/server/pos";
import type { ActionResult } from "./actions";

/** "RWF 14,000" (whole francs). */
export const money = (n: number) => formatRwf(Math.round(n));

/** "19:48" in Kigali. */
export const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

/**
 * One colour per table state, distinct at a glance: free is green, taken is amber, waiting to pay is red, and the
 * states no guest is in are grey. (The brand accent is green too, so it never stands for "occupied".)
 */
export const TABLE_COLOR: Record<TableStatus, ChipColor> = {
  available: "success",
  occupied: "warning",
  reserved: "default",
  bill_requested: "danger",
  cleaning: "default",
};

export const ORDER_COLOR: Record<OrderStatus, ChipColor> = {
  draft: "default",
  submitted: "accent",
  in_progress: "warning",
  ready: "success",
  delivered: "success",
  completed: "default",
  cancelled: "danger",
};

export const TICKET_COLOR: Record<TicketStatus, ChipColor> = {
  queued: "default",
  preparing: "warning",
  ready: "success",
  served: "default",
  cancelled: "danger",
};

export function StatusChip({ color, children }: { color: ChipColor; children: ReactNode }) {
  return (
    <Chip size="sm" variant="soft" color={color}>
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

/** The stamp on every screen that takes or shows a payment. */
export function SimulationNotice({ children }: { children?: ReactNode }) {
  return (
    <Alert status="warning" className="py-2">
      <Alert.Indicator>
        <CircleInfo />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title className="text-[13px]">Demo mode</Alert.Title>
        <Alert.Description className="text-[12px]">
          {children ?? "Payments are simulated: no money moves and no provider is contacted."}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/**
 * Run a server action and refresh the screen from what the API now holds. A refusal shows as the API's own
 * sentence in a toast; success shows `done` when given.
 */
export function usePosAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run<T>(
    act: () => Promise<ActionResult<T>>,
    done?: string | null | ((value: T) => string | null),
    after?: (value: T) => void,
  ) {
    start(async () => {
      const result = await act();
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      const message = typeof done === "function" ? done(result.value) : done;
      if (message) toast.success(message);
      after?.(result.value);
      router.refresh();
    });
  }
  return { run, pending };
}

/**
 * A dialog's title that survives its own exit animation. The screen sets its dialog state to null the moment the
 * dialog closes, so a title computed from that state is empty while the dialog is still fading out, and an
 * unlabelled dialog is an accessibility fault (and a console warning). Remembering the last real title fixes both.
 */
export function useStickyTitle(title: string): string {
  const last = useRef(title);
  if (title) last.current = title;
  return title || last.current;
}

/**
 * A key that changes every time a dialog is opened afresh. A closed dialog stays in the page for a moment while it
 * fades, and a dialog opened in that moment lands on the old, emptied shell (right title, no fields). Giving the
 * dialog this key remounts it on each fresh open, while closing still animates. Pass an identity for what is open
 * (null when nothing is).
 */
export function useDialogKey(identity: string | null): number {
  const seq = useRef(0);
  const last = useRef<string | null>(null);
  if (identity !== null && identity !== last.current) seq.current += 1;
  last.current = identity;
  return seq.current;
}

/** One press, one key: a retried press of the same dialog reuses it, so the API answers with the first result. */
export function usePressKey(): [string, () => void] {
  const [key, setKey] = useState(() => crypto.randomUUID());
  return [key, () => setKey(crypto.randomUUID())];
}

/** The POS dialog: a heading, a body, and its own footer actions. */
export function PosDialog({
  isOpen,
  onOpenChange,
  title,
  subtitle,
  children,
  footer,
  wide,
  onEnter,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
  /** Pressing Enter in a field submits the dialog (not offered for a destructive confirmation). */
  onEnter?: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} className="h-full">
      <Modal.Container placement="center" className="h-full px-[16px] py-[20px] sm:w-full">
        <Modal.Dialog
          aria-label={title}
          className={`max-h-full gap-[14px] overflow-y-auto rounded-[24px] p-[24px] ${wide ? "sm:max-w-[720px]" : "sm:max-w-[480px]"}`}
        >
          <Modal.Header className="flex-row items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <Modal.Heading slot="title" className="text-[20px] leading-[26px] font-semibold">
                {title}
              </Modal.Heading>
              {subtitle ? <span className="text-[13px] text-muted tabular">{subtitle}</span> : null}
            </div>
            <Button variant="ghost" isIconOnly aria-label="Close" onPress={() => onOpenChange(false)}>
              <Xmark className="size-4" />
            </Button>
          </Modal.Header>
          <Modal.Body
            className="m-0 flex flex-col gap-[14px] p-0 text-[14px] text-foreground"
            onKeyDown={(e) => {
              if (
                onEnter &&
                e.key === "Enter" &&
                !e.shiftKey &&
                e.target instanceof HTMLInputElement &&
                e.target.type !== "radio" &&
                e.target.type !== "checkbox"
              ) {
                e.preventDefault();
                onEnter();
              }
            }}
          >
            {children}
          </Modal.Body>
          <Modal.Footer className="mt-0 flex-wrap justify-end gap-[8px] border-t border-separator pt-[12px]">
            {footer}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Whole RWF typed by a person: digits only, or null. */
export function parseRwf(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}
