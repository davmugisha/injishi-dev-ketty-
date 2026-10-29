"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** True while the media query matches; false on the server and before hydration. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True when the person asked the system for less motion: skip chart and number animations. */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/**
 * The rendered width of an element, kept up to date; 0 until it is measured in the browser. Returns a
 * callback ref, so it follows the element when it is unmounted and mounted again.
 */
export function useElementWidth<E extends HTMLElement = HTMLDivElement>(): [(el: E | null) => void, number] {
  const [el, setEl] = useState<E | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  const ref = useCallback((node: E | null) => setEl(node), []);
  return [ref, width];
}

/**
 * Keep everything inside `el` out of the tab order. Charts draw their own keyboard layer; a chart whose
 * numbers are offered as a summary and a table view is hidden from assistive technology, and nothing
 * hidden may take focus.
 */
export function useNoFocusInside(): (el: HTMLElement | null) => void {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!el) return;
    const strip = () => {
      for (const node of el.querySelectorAll<HTMLElement>("[tabindex]:not([tabindex='-1'])")) node.tabIndex = -1;
    };
    strip();
    const observer = new MutationObserver(strip);
    observer.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["tabindex"] });
    return () => observer.disconnect();
  }, [el]);
  return useCallback((node: HTMLElement | null) => setEl(node), []);
}
