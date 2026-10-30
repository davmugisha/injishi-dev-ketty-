import { Card } from "@heroui/react";
import type { ReactNode } from "react";

/** "Jeanne Nyiraneza" → "JN" (first letters of the first two names, as the artifact does). */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
}

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * The boards' default panel: a Card with an 18px (or 16px) inset, a 15px title, an optional
 * description and an optional trailing action in the header row (artifact: card card--default).
 */
export function PanelCard({
  id,
  title,
  description,
  action,
  leading,
  dense = false,
  className,
  children,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  leading?: ReactNode;
  /** 16px inset (roster, attendance) instead of 18px. */
  dense?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      aria-labelledby={id}
      className={cx("min-w-0", dense ? "p-4" : "p-[18px]", className ?? "gap-3")}
      render={(props) => <section {...(props as object)} />}
    >
      <Card.Header className="flex flex-row items-start gap-2.5">
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Card.Title
            id={id}
            className="text-[15px] leading-[22px] font-semibold"
            render={(props) => <h2 {...(props as object)} />}
          >
            {title}
          </Card.Title>
          {description ? <Card.Description>{description}</Card.Description> : null}
        </div>
        {action}
      </Card.Header>
      {children}
    </Card>
  );
}
