"use client";

import { useEffect, useState } from "react";

/**
 * Whether a media query matches, after mount. False on the server and on the
 * first client render, so SSR and hydration agree; true only once the browser
 * has said so. Use it to avoid MOUNTING something heavy where CSS would only
 * hide it (the rail's mini map loads maplibre-gl, ~200 KB gz).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener("change", sync);
    return () => list.removeEventListener("change", sync);
  }, [query]);
  return matches;
}
