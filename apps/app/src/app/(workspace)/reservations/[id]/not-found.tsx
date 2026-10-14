"use client";

import { ArrowLeft, CalendarXmark } from "@gravity-ui/icons";
import { EmptyState } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import { LinkButton, PageContent } from "@injishi/ui";
import { usePathname } from "next/navigation";

/** A booking id under /reservations/[id] without a reservation record: point to the booking in the list. */
export default function ReservationNotFound() {
  const pathname = usePathname() ?? "";
  const id = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
  const list = screenHref("Reservations");
  return (
    <PageContent className="text-[14px] leading-5">
      <EmptyState className="py-16">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <CalendarXmark />
          </EmptyState.Media>
          <EmptyState.Title>No reservation record for {id || "this booking"}</EmptyState.Title>
          <EmptyState.Description>
            The booking's dates, room, guests, terms and payment are shown in Reservations.
          </EmptyState.Description>
        </EmptyState.Header>
        <EmptyState.Content className="flex flex-row flex-wrap justify-center gap-2">
          {id ? (
            <LinkButton href={`${list}?booking=${encodeURIComponent(id)}`}>Show {id} in Reservations</LinkButton>
          ) : null}
          <LinkButton href={list} variant="secondary">
            <ArrowLeft className="size-4" />
            Back to reservations
          </LinkButton>
        </EmptyState.Content>
      </EmptyState>
    </PageContent>
  );
}
