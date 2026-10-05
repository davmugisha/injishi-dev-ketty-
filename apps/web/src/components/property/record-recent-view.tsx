"use client";

import { useEffect } from "react";
import { recordRecentlyViewed } from "@/hooks/use-recently-viewed";

/**
 * Renders nothing; notes that this stay's page was opened, so Explore's
 * "Recently viewed" rail can offer the way back to it.
 */
export function RecordRecentView({ slug }: { slug: string }) {
  useEffect(() => {
    recordRecentlyViewed(slug);
  }, [slug]);
  return null;
}
