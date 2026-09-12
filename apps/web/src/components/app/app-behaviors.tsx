"use client";

import { useEffect } from "react";

/**
 * Delegated interactions for the authenticated screens.
 * Replaces the live half of public/shared/js/injishi-state.js.
 *
 * That script wired nine behaviours; only these have call sites left, so the
 * rest were dropped rather than ported:
 *
 *   dropped          why
 *   ---------------  ---------------------------------------------------------
 *   header scroll    no `#in-header[data-overlay]` in the tree
 *   mobile menu      no `[data-mobile-menu-open]` and no `#in-mobile-menu`
 *   accordions       no `[data-accordion-toggle]`
 *   counters         no `[data-counter]`
 *   OTP inputs       the one `[data-otp]` screen is /verify-otp, which never
 *                    loaded injishi-state.js — <OtpController/> owns it, against
 *                    real Better Auth rather than the prototype's mock
 *
 * Delegated on `document` for the same reason as <ThemeToggle/>: the markup
 * lives in Server Components and capture-derived pages.
 *
 * Theme is NOT handled here — <ThemeToggle/> owns it for every surface. Mount
 * both; they do not overlap.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

let lastFocused: HTMLElement | null = null;

function focusables(container: Element) {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null,
  );
}

function openDialog(id: string) {
  const dialog = document.getElementById(id);
  if (!dialog) return;
  lastFocused = document.activeElement as HTMLElement | null;
  dialog.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  focusables(dialog)[0]?.focus();
}

function closeDialog(dialog: Element) {
  dialog.classList.add("hidden");
  document.body.style.overflow = "";
  lastFocused?.focus?.();
  lastFocused = null;
}

export default function AppBehaviors() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // ---- Dialogs -------------------------------------------------------
      const opener = target.closest("[data-dialog-open]");
      if (opener) {
        e.preventDefault();
        const id = opener.getAttribute("data-dialog-open");
        if (id) openDialog(id);
        return;
      }
      const closer = target.closest("[data-dialog-close]");
      if (closer) {
        const dialog = closer.closest("[data-dialog]");
        if (dialog) closeDialog(dialog);
        return;
      }

      // ---- Tabs ----------------------------------------------------------
      const tab = target.closest("[data-tab]");
      const group = tab?.closest("[data-tabs]");
      if (tab && group) {
        const key = tab.getAttribute("data-tab");
        for (const t of group.querySelectorAll("[data-tab]")) {
          const active = t === tab;
          t.setAttribute("aria-selected", String(active));
          t.classList.toggle("bg-primary", active);
          t.classList.toggle("text-primary-foreground", active);
        }
        for (const panel of group.querySelectorAll("[data-tab-panel]")) {
          panel.classList.toggle("hidden", panel.getAttribute("data-tab-panel") !== key);
        }
        return;
      }

      // ---- Language label ------------------------------------------------
      // Visual only, as in the prototype: no strings are swapped. Paraglide
      // (F-A20) replaces this outright.
      const lang = target.closest("[data-lang-toggle]");
      const label = lang?.querySelector("[data-lang-label]");
      if (lang && label) {
        const next = label.textContent?.trim() === "EN" ? "RW" : "EN";
        label.textContent = next;
        lang.setAttribute(
          "aria-label",
          `Switch language — ${next === "EN" ? "English" : "Kinyarwanda"} active`,
        );
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const open = document.querySelector("[data-dialog]:not(.hidden)");
        if (open) closeDialog(open);
        return;
      }
      if (e.key !== "Tab") return;
      // Keep focus inside an open dialog.
      const dialog = document.querySelector("[data-dialog]:not(.hidden)");
      if (!dialog) return;
      const items = focusables(dialog);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}

