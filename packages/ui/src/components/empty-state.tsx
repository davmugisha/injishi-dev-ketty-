"use client";

/**
 * EmptyState, from HeroUI Pro (`@heroui-pro/react`, a paid licence).
 *
 * What a list says when it has nothing in it: an icon, a title, one line on
 * why, and the action that fills it. `Media` takes any icon (this repo uses
 * `lucide-react`), `Content` takes the buttons.
 *
 *   <EmptyState>
 *     <EmptyState.Media><CalendarCheck /></EmptyState.Media>
 *     <EmptyState.Header>
 *       <EmptyState.Title>No arrivals today</EmptyState.Title>
 *       <EmptyState.Description>Bookings that start today show here.</EmptyState.Description>
 *     </EmptyState.Header>
 *   </EmptyState>
 *
 * Apps reach Pro only through this package; see `kpi.tsx` for why, and for
 * the install token every build needs.
 */
export { EmptyState } from "@heroui-pro/react";
export type { EmptyStateProps } from "@heroui-pro/react";
