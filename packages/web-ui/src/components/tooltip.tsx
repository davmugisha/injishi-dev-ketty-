"use client";

import * as React from "react";
import { Tooltip as HeroTooltip } from "@heroui/react";

/**
 * The hover/focus hint, on HeroUI 3.
 *
 * Two things change from the Radix version, and both are fixes rather than
 * ports:
 *
 *  - There is no `TooltipProvider`. React Aria's warmup timer is global, so the
 *    "second tooltip opens instantly" behaviour a provider used to configure is
 *    already on. It is exported as a pass-through so existing trees keep
 *    compiling; it renders nothing of its own.
 *  - The trigger must be FOCUSABLE. React Aria binds the tooltip to focus as
 *    well as hover, which is what makes it reachable by keyboard at all. The
 *    old version happily attached a tooltip to a bare `<span>`, and that
 *    tooltip could not be opened without a mouse.
 */
const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

const Tooltip = HeroTooltip;
const TooltipTrigger = HeroTooltip.Trigger;
const TooltipContent = HeroTooltip.Content;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
