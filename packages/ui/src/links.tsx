import { buttonVariants, linkVariants } from "@heroui/styles";
import NextLink from "next/link";
import type { ComponentProps } from "react";

type NextLinkProps = ComponentProps<typeof NextLink>;

export interface LinkButtonProps extends NextLinkProps {
  variant?: "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger" | "danger-soft";
  size?: "sm" | "md" | "lg";
  isIconOnly?: boolean;
  fullWidth?: boolean;
}

/** A Next.js link styled as a HeroUI Button (HeroUI's documented `buttonVariants` composition). */
export function LinkButton({
  variant = "primary",
  size = "md",
  isIconOnly,
  fullWidth,
  className,
  ...props
}: LinkButtonProps) {
  return <NextLink {...props} className={buttonVariants({ variant, size, isIconOnly, fullWidth, className })} />;
}

/** A Next.js link styled as a HeroUI Link. */
export function TextLink({ className, ...props }: NextLinkProps) {
  return <NextLink {...props} className={linkVariants().base({ className })} />;
}
