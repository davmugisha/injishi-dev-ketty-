"use client";

import { Modal } from "@heroui/react";
import { type Key, type ReactNode, useId } from "react";

/*
 * The form pieces Channels (Marketplace's) and Outlet menus (Outlets') draw. They were `./shared`, which
 * moves with PMS's housekeeping, maintenance, lost and found and loyalty boards in ADR-074 stage 4; a
 * product never imports an app and the app never reaches into a product's internals, so the two boards that
 * stay keep this copy until they move with their own products (stages 5 and 7).
 */

/** Field label used above groups inside cards (artifact: .label). */
export function FieldLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span id={id} className="text-[13px] leading-[18px] font-medium">
      {children}
    </span>
  );
}

/** A modal dialog for a short form or decision (artifact: .ij-dialog on .ij-scrim). */
export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  const id = useId();
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="md">
        <Modal.Dialog aria-labelledby={id}>
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="flex flex-col items-start gap-1">
            <Modal.Heading id={id} className="text-lg leading-[26px] font-semibold">
              {title}
            </Modal.Heading>
            {description ? <p className="text-[13px] text-muted">{description}</p> : null}
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
          <Modal.Footer className="flex flex-wrap items-center justify-end gap-2">{footer}</Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Muted helper line that sits at the start of a dialog footer. */
export function FooterHint({ children }: { children: ReactNode }) {
  return <span className="mr-auto min-w-0 flex-[1_1_200px] text-[12px] leading-4 text-muted">{children}</span>;
}

/** First selected key of a single-selection collection (tables, lists). */
export function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k == null ? null : String(k);
}
