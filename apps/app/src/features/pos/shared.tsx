"use client";

import { CircleInfo, Xmark } from "@gravity-ui/icons";
import { Alert, Button, Chip, Modal, toast } from "@heroui/react";
import { formatRwf } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import type { OrderStatus, TableStatus, TicketStatus } from "@/server/pos";
import type { ActionResult } from "./actions";

/** "RWF 14,000" (whole francs). */
export const money = (n: number) => formatRwf(Math.round(n));

/** "19:48" in Kigali. */
export const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

export const TABLE_COLOR: Record<TableStatus, ChipColor> = {
  available: "success",
  occupied: "accent",
  reserved: "warning",
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
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
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
              <Modal.Heading className="text-[20px] leading-[26px] font-semibold">{title}</Modal.Heading>
              {subtitle ? <span className="text-[13px] text-muted tabular">{subtitle}</span> : null}
            </div>
            <Button variant="ghost" isIconOnly aria-label="Close" onPress={() => onOpenChange(false)}>
              <Xmark className="size-4" />
            </Button>
          </Modal.Header>
          <Modal.Body className="m-0 flex flex-col gap-[14px] p-0 text-[14px] text-foreground">{children}</Modal.Body>
          <Modal.Footer className="mt-0 flex-wrap justify-end gap-[8px] border-t border-separator pt-[12px]">{footer}</Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** The bar across the top of every live POS screen: where you are and how to move between the POS screens. */
export function PosHeader({
  title,
  outlet,
  children,
}: {
  title: string;
  outlet: { name: string; branchName: string | null } | null;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-separator bg-surface px-5 py-3">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-[18px] leading-6 font-semibold">{title}</h1>
        {outlet ? (
          <span className="text-[12px] text-muted">
            {outlet.name}
            {outlet.branchName ? ` · ${outlet.branchName}` : ""}
          </span>
        ) : null}
      </div>
      <span className="flex-1" />
      {children}
    </header>
  );
}

/** Whole RWF typed by a person: digits only, or null. */
export function parseRwf(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}
