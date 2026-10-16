"use client";

import * as React from "react";
import { cn } from "@injishi/utils";

/**
 * A modal on the platform's own `<dialog>`, opened with `showModal()` (ADR-040
 * call 3). It sits beside `Dialog` rather than being a mode of it: `Dialog` is
 * `DialogPrimitive.Root`, a Radix compound object with no props of its own, so
 * a mode flag has nowhere to live.
 *
 * What the platform gives it, and a portalled div cannot have:
 *   - the top layer, so it stacks above everything with no z-index contest;
 *   - a focus trap and Escape to close, with no script of ours;
 *   - `::backdrop`, which matches ONLY a native modal dialog. The scrim rule is
 *     in `styles.css`, keyed on this component's `data-slot`, and it is the one
 *     copy: it used to be `.in-dialog::backdrop` in `apps/admin`'s stylesheet.
 *
 * It does NOT compose with `DialogPortal`, `DialogTrigger` or `DialogClose`.
 * Those are Radix parts and talk to Radix state this component does not have.
 * Open it with `open`, close it by setting `open` false from `onClose`.
 *
 * The panel is `max-w-form` by default; a caller widens it through `className`
 * with another named width (`max-w-narrow`), and `cn` lets that win.
 *
 * It is also the portal container for the package's anchored overlays. A Radix
 * `Select`, `Popover` or `DropdownMenu` portals into `document.body` by default,
 * and `showModal()` makes everything outside the dialog inert and paints the
 * dialog above it, so a list opened from inside would land behind the scrim
 * and refuse every click. Those three read `useNativeDialogContainer()` and
 * portal into the dialog instead. Outside a dialog it is `undefined`, which is
 * Radix's own default, so nothing changes anywhere else.
 */
const NativeDialogContainer = React.createContext<HTMLElement | null>(null);

function useNativeDialogContainer(): HTMLElement | undefined {
  return React.useContext(NativeDialogContainer) ?? undefined;
}

/*
 * Every native dialog open right now, oldest first.
 *
 * `Toaster` reads the topmost one. A toast is rendered at the app shell, and
 * `showModal()` paints the dialog in the top layer and makes the shell inert,
 * so a message raised while a dialog is open — "Nothing was sent: this needs a
 * reason", "Couldn't confirm the suspension" — used to appear UNDER the scrim,
 * blurred and unread, and then time out. The person saw their press do nothing.
 * Portalling the toast region into the topmost dialog puts it where they are
 * looking, and inside the one subtree a screen reader can still reach.
 */
const openDialogs: HTMLDialogElement[] = [];
const listeners = new Set<() => void>();

function track(dlg: HTMLDialogElement, isOpen: boolean) {
  const at = openDialogs.indexOf(dlg);
  if (isOpen && at === -1) openDialogs.push(dlg);
  if (!isOpen && at !== -1) openDialogs.splice(at, 1);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The dialog a person is looking at, or `null` when none is open. */
function useTopmostNativeDialog(): HTMLDialogElement | null {
  return React.useSyncExternalStore(
    subscribe,
    () => openDialogs[openDialogs.length - 1] ?? null,
    () => null,
  );
}

function NativeDialog({
  open,
  onClose,
  ariaLabel,
  dismissible = true,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  /**
   * Whether Escape and a backdrop click may close it. Pass `false` while the
   * dialog's work is in flight: the browser closes a modal on Escape by
   * itself, so without this a person could dismiss a write half way, the
   * dialog would vanish, and its outcome would arrive later with nothing on
   * screen to explain it.
   */
  dismissible?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  // State, not the ref, so the children re-render with the element once it exists.
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const openRef = React.useRef(open);
  const dismissibleRef = React.useRef(dismissible);
  openRef.current = open;
  dismissibleRef.current = dismissible;

  React.useEffect(() => setContainer(ref.current), []);

  React.useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
    track(dlg, dlg.open);
    return () => track(dlg, false);
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-slot="native-dialog"
      aria-label={ariaLabel}
      className={cn(
        // `m-auto` centres it: Tailwind's preflight zeroes the margin the
        // browser uses to place a modal dialog in the middle of the viewport.
        "m-auto w-[calc(100%-2rem)] max-w-form p-0",
        "bg-background text-foreground rounded-card shadow-xl",
        // Set down in front of the person rather than switched on.
        "open:animate-settle-in",
        className,
      )}
      onCancel={(e) => {
        // Escape. Refused while the work is in flight; the dialog stays.
        if (!dismissibleRef.current) e.preventDefault();
      }}
      onClose={() => {
        const dlg = ref.current;
        // A browser may still force a modal shut (a second Escape). If the
        // caller has not let go, put it back rather than leave React believing
        // a closed dialog is open.
        if (dlg && openRef.current && !dismissibleRef.current) {
          dlg.showModal();
          return;
        }
        if (dlg) track(dlg, false);
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === ref.current && dismissibleRef.current) onClose();
      }}
    >
      <NativeDialogContainer.Provider value={container}>
        {children}
      </NativeDialogContainer.Provider>
    </dialog>
  );
}

export { NativeDialog, useNativeDialogContainer, useTopmostNativeDialog };
