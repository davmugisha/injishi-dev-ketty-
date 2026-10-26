"use client";

import * as React from "react";
import { cn } from "@injishi/utils";

/* `as="dl"` (ADR-040 call 3) makes a card a description list, which is what a
 * screen reader announces a statistic as: the title becomes the term (`<dt>`)
 * and the description its value (`<dd>`). The two children learn which form
 * they are in from this context, so a caller writes `as` once, on the card.
 *
 * It needs context, and context needs a client module; that is the only reason
 * this file carries "use client". A server component still renders `<Card>`
 * with server children exactly as before.
 *
 * Inside `as="dl"` only a term and its value, or a `<div>` wrapping them (which
 * is what `CardHeader` is), is valid HTML. `CardContent` and `CardFooter` hold
 * arbitrary content, so do not put them in a `dl` card unless what they hold is
 * itself a `<dd>`. This is the structure `apps/admin`'s `StatCard` was reaching
 * for and missed: it put `<dt>` and `<dd>` in a plain `<div>` with no list. */
type CardForm = "div" | "dl";

const CardFormContext = React.createContext<CardForm>("div");

type CardProps =
  | ({ as?: "div" } & React.ComponentProps<"div">)
  | ({ as: "dl" } & React.ComponentProps<"dl">);

const CARD = "bg-card text-card-foreground flex flex-col rounded-card";

function Card(props: CardProps) {
  // Branch rather than pick a tag into a variable: each element then keeps its
  // own props type, `ref` included, with no cast between the two.
  if (props.as === "dl") {
    const { as, className, ...rest } = props;
    return (
      <CardFormContext.Provider value={as}>
        <dl data-slot="card" className={cn(CARD, className)} {...rest} />
      </CardFormContext.Provider>
    );
  }
  const { as: _div, className, ...rest } = props;
  return (
    <CardFormContext.Provider value="div">
      <div data-slot="card" className={cn(CARD, className)} {...rest} />
    </CardFormContext.Provider>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  const Element = React.useContext(CardFormContext) === "dl" ? "dt" : "div";
  return (
    <Element
      data-slot="card-title"
      className={cn("font-semibold leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  const Element = React.useContext(CardFormContext) === "dl" ? "dd" : "div";
  return (
    <Element
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn(className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
