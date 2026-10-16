"use client";

/**
 * KPI and KPIGroup, from HeroUI Pro (`@heroui-pro/react`, a paid licence).
 *
 * One figure with its title, trend, an optional progress bar or sparkline, and
 * a group that lays several out as one strip with separators. The operator
 * app's Today strip and Finance's revenue figures are what this is for.
 *
 * Apps reach Pro only through this package (library-docs.md § Shared
 * Packages), for the same one-copy reason as `no-duplicate-shared-component`,
 * and so a licence or version move is one place. The components are Pro's own,
 * unchanged: they read the HeroUI variables `@injishi/design-tokens/heroui.css`
 * sets, so they wear the Injishi palette with no overrides here.
 *
 * KPI is a SUBPATH import (`@heroui-pro/react/kpi`) because it draws its
 * sparkline with `recharts`, an optional Pro peer this package declares. The
 * barrel never pulls it, so a page that never renders a KPI never loads it.
 *
 * Every build needs Pro's real code, which its postinstall downloads with a
 * developer's `heroui-pro login` or `HEROUI_AUTH_TOKEN` (the team's CI/CD
 * token in CI and Docker; never a personal token). Without it, the first
 * import of this file is what fails the build.
 */
export { KPI } from "@heroui-pro/react/kpi";
export type {
  KPIProps,
  KPIValueProps,
  KPITrendProps,
  KPIIconProps,
  KPIProgressProps,
  KPIChartProps,
} from "@heroui-pro/react/kpi";
export { KPIGroup } from "@heroui-pro/react";
export type { KPIGroupProps } from "@heroui-pro/react";
