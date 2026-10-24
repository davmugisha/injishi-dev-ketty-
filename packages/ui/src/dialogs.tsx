"use client";

import { Alert, AlertDialog, Drawer, Form, Modal } from "@heroui/react";
import { type FormEvent, type ReactNode, useId } from "react";
import { ActionButton } from "./buttons.tsx";
import { useMediaQuery } from "./hooks.ts";
import { Icon, type IconKey } from "./icon.tsx";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** md and up: a side panel slides in from the right; below it, a bottom sheet. */
const DESKTOP = "(min-width: 768px)";

/** What a dialog or side panel that holds a form needs. One Save in the footer, beside Cancel. */
export interface PanelFormProps {
  /** The Save button's words ("Save", "Record payment"). Makes the content a form. */
  submitLabel: string;
  /** @default "Check" */
  submitIcon?: IconKey;
  /** A client handler. Call `event.preventDefault()` when you handle it yourself. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** A server action (with `useActionState`), as the form's `action`. */
  action?: (formData: FormData) => void | Promise<void>;
  /** Saving: the Save button spins, everything stays put, and the dialog can't be dismissed. */
  isPending?: boolean;
  /**
   * Errors by field name (from the shared zod schema or the API), shown under each named field. The form
   * never shows the browser's own messages: required fields are checked by the caller, in our words.
   */
  validationErrors?: Record<string, string | string[]>;
  /** An error about the whole form ("That unit already has a lease from 1 March"), shown at the top. */
  formError?: ReactNode;
  /** @default "Cancel" */
  cancelLabel?: string;
  /** Disables Save, e.g. until something changed. */
  isSubmitDisabled?: boolean;
}

function FormErrorAlert({ children }: { children: ReactNode }) {
  return (
    <Alert status="danger">
      <Alert.Indicator>
        <Icon name="CircleExclamation" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{children}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

function FormFooterButtons({
  submitLabel,
  submitIcon = "Check",
  isPending,
  cancelLabel = "Cancel",
  isSubmitDisabled,
  onCancel,
}: Pick<PanelFormProps, "submitLabel" | "submitIcon" | "isPending" | "cancelLabel" | "isSubmitDisabled"> & {
  onCancel: () => void;
}) {
  return (
    <>
      <ActionButton icon="Xmark" onPress={onCancel} isDisabled={isPending}>
        {cancelLabel}
      </ActionButton>
      <ActionButton type="submit" icon={submitIcon} intent="accent" isPending={isPending} isDisabled={isSubmitDisabled}>
        {submitLabel}
      </ActionButton>
    </>
  );
}

export interface FormDialogProps extends PanelFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** One helper line under the title, only when it adds something. */
  description?: ReactNode;
  /** The fields. Give each a `name` so `validationErrors` can reach it. */
  children: ReactNode;
  /** "sm" for a question with one field, "md" for a short form. @default "md" */
  size?: "sm" | "md" | "lg";
  /** A short muted line at the start of the footer ("The tenant gets an email"). */
  footerHint?: ReactNode;
}

/**
 * A short form in a dialog: title, the fields, then Cancel and one outlined Save. Saving shows a spinner
 * on Save and keeps the dialog open; field errors show under their fields, a form error at the top.
 * A longer form belongs in a `SidePanel`.
 */
export function FormDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  footerHint,
  submitLabel,
  submitIcon,
  onSubmit,
  action,
  isPending,
  validationErrors,
  formError,
  cancelLabel,
  isSubmitDisabled,
}: FormDialogProps) {
  const headingId = useId();
  const close = () => onOpenChange(false);
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => (isPending && !open ? undefined : onOpenChange(open))}
      isDismissable={!isPending}
      isKeyboardDismissDisabled={isPending}
    >
      <Modal.Container size={size} scroll="inside">
        <Modal.Dialog aria-labelledby={headingId}>
          <Form
            onSubmit={onSubmit}
            action={action}
            validationErrors={validationErrors}
            validationBehavior="aria"
            className="flex min-h-0 flex-1 flex-col"
          >
            <Modal.CloseTrigger aria-label="Close" isDisabled={isPending} />
            <Modal.Header className="flex flex-col items-start gap-1 pr-8">
              <Modal.Heading id={headingId} className="text-lg font-semibold text-pretty">
                {title}
              </Modal.Heading>
              {description ? <p className="text-sm text-pretty text-muted">{description}</p> : null}
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4 text-foreground">
              {formError ? <FormErrorAlert>{formError}</FormErrorAlert> : null}
              {children}
            </Modal.Body>
            <Modal.Footer className="flex flex-col items-stretch gap-3">
              {footerHint ? <p className="text-xs text-pretty text-muted">{footerHint}</p> : null}
              <div className="flex flex-wrap justify-end gap-2">
                <FormFooterButtons
                  submitLabel={submitLabel}
                  submitIcon={submitIcon}
                  isPending={isPending}
                  cancelLabel={cancelLabel}
                  isSubmitDisabled={isSubmitDisabled}
                  onCancel={close}
                />
              </div>
            </Modal.Footer>
          </Form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question: "Cancel this lease?" */
  title: ReactNode;
  /** What happens, in one or two short sentences. */
  children?: ReactNode;
  /** The action's words ("Cancel lease"). Never "Yes" or "OK". */
  confirmLabel: string;
  confirmIcon?: IconKey;
  /** "danger" for something that can't be undone. @default "default" */
  intent?: "default" | "danger";
  onConfirm: () => void;
  isPending?: boolean;
  /** @default "Keep it" for danger, otherwise "Cancel" */
  cancelLabel?: string;
}

/**
 * A yes-or-no question before something that matters (cancel a lease, void an expense). The confirm
 * button names the action; the dialog stays open, spinning, until `isPending` clears.
 */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  children,
  confirmLabel,
  confirmIcon,
  intent = "default",
  onConfirm,
  isPending,
  cancelLabel,
}: ConfirmDialogProps) {
  const danger = intent === "danger";
  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => (isPending && !open ? undefined : onOpenChange(open))}
      isDismissable={!isPending}
      isKeyboardDismissDisabled={isPending}
    >
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status={danger ? "danger" : "accent"}>
              <Icon name={danger ? "TriangleExclamation" : "CircleQuestion"} className="size-5" />
            </AlertDialog.Icon>
            <AlertDialog.Heading className="text-lg font-semibold text-pretty">{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          {children ? <AlertDialog.Body className="text-sm text-pretty text-muted">{children}</AlertDialog.Body> : null}
          <AlertDialog.Footer className="flex flex-wrap justify-end gap-2">
            <ActionButton icon="Xmark" slot="close" isDisabled={isPending}>
              {cancelLabel ?? (danger ? "Keep it" : "Cancel")}
            </ActionButton>
            <ActionButton
              icon={confirmIcon ?? (danger ? "TrashBin" : "Check")}
              intent={danger ? "danger" : "accent"}
              isPending={isPending}
              onPress={onConfirm}
            >
              {confirmLabel}
            </ActionButton>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}

export interface SidePanelProps extends Partial<PanelFormProps> {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** One muted line under the title (a reference, a unit, a date). */
  description?: ReactNode;
  /** A status chip or other small trailing content beside the title. */
  headerExtra?: ReactNode;
  children: ReactNode;
  /** A custom footer when the panel is not a form. With `submitLabel`, the footer is Cancel and Save. */
  footer?: ReactNode;
  /** "md" for forms and records, "lg" for wide content such as a contract. @default "md" */
  size?: "md" | "lg";
}

/**
 * A record or a longer form beside the page: from the right on a desktop, as a bottom sheet on a phone.
 * Selects, date pickers and menus inside open above it and stay clickable (they render in a layer over
 * the panel). With `submitLabel` the content is a form with one Save in the footer.
 */
export function SidePanel({
  isOpen,
  onOpenChange,
  title,
  description,
  headerExtra,
  children,
  footer,
  size = "md",
  submitLabel,
  submitIcon,
  onSubmit,
  action,
  isPending,
  validationErrors,
  formError,
  cancelLabel,
  isSubmitDisabled,
}: SidePanelProps) {
  const desktop = useMediaQuery(DESKTOP);
  const headingId = useId();
  const close = () => onOpenChange(false);
  const isForm = Boolean(submitLabel);

  const header = (
    <Drawer.Header className="flex flex-row items-start gap-3 pr-10">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Drawer.Heading id={headingId} className="text-lg font-semibold text-pretty">
          {title}
        </Drawer.Heading>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {headerExtra ? <div className="flex shrink-0 items-center gap-2 pt-0.5">{headerExtra}</div> : null}
    </Drawer.Header>
  );
  const body = (
    <Drawer.Body className="flex flex-col gap-4 text-foreground">
      {formError ? <FormErrorAlert>{formError}</FormErrorAlert> : null}
      {children}
    </Drawer.Body>
  );
  const footerContent = isForm ? (
    <FormFooterButtons
      submitLabel={submitLabel as string}
      submitIcon={submitIcon}
      isPending={isPending}
      cancelLabel={cancelLabel}
      isSubmitDisabled={isSubmitDisabled}
      onCancel={close}
    />
  ) : (
    footer
  );

  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => (isPending && !open ? undefined : onOpenChange(open))}
      isDismissable={!isPending}
      isKeyboardDismissDisabled={isPending}
    >
      <Drawer.Content placement={desktop ? "right" : "bottom"}>
        <Drawer.Dialog
          aria-labelledby={headingId}
          className={cx("gap-0 p-0", desktop && (size === "lg" ? "w-2xl" : "w-md"))}
        >
          {!desktop ? <Drawer.Handle className="pt-2" /> : null}
          <Drawer.CloseTrigger aria-label="Close" isDisabled={isPending} />
          {isForm ? (
            <Form
              onSubmit={onSubmit}
              action={action}
              validationErrors={validationErrors}
              validationBehavior="aria"
              className="flex min-h-0 flex-1 flex-col"
            >
              <PanelLayout header={header} body={body} footer={footerContent} />
            </Form>
          ) : (
            <PanelLayout header={header} body={body} footer={footerContent} />
          )}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

function PanelLayout({ header, body, footer }: { header: ReactNode; body: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pt-5 pb-3">{header}</div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5">{body}</div>
      {footer ? (
        <Drawer.Footer className="flex flex-wrap justify-end gap-2 border-t border-separator px-5 py-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))]">
          {footer}
        </Drawer.Footer>
      ) : null}
    </div>
  );
}
