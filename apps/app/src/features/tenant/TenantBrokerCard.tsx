"use client";

import { toast } from "@heroui/react";
import type { TenancyDetail } from "@injishi/contracts";
import { ActionButton, FormDialog, formatDay, SectionCard, StarInput, Stars } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TextInput } from "../rentals/fields";
import { rateBrokerAsTenant } from "./actions";

/**
 * The broker who found the tenant this home (2026-10-25): the tenant rates them once the tenancy has
 * started, and can change the rating later.
 */
export function TenantBrokerCard({ tenancy }: { tenancy: TenancyDetail }) {
  const broker = tenancy.broker;
  const [open, setOpen] = useState(false);
  if (!broker) return null;
  return (
    <SectionCard
      title="Broker"
      actions={
        broker.canRate ? (
          <ActionButton size="sm" icon="Star" onPress={() => setOpen(true)}>
            {broker.rating ? "Change rating" : "Rate"}
          </ActionButton>
        ) : null
      }
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{broker.name ?? "Your broker"}</span>
        {broker.rating ? (
          <span className="flex items-center gap-2">
            <Stars value={broker.rating.stars} size="size-3.5" />
            <span className="text-xs text-muted">{formatDay(broker.rating.ratedAt, "short")}</span>
          </span>
        ) : (
          <span className="text-xs text-muted">
            {broker.canRate ? "How was finding this home with them?" : "You can rate them once you move in."}
          </span>
        )}
      </div>
      <RateBrokerDialog tenancy={tenancy} isOpen={open} onOpenChange={setOpen} />
    </SectionCard>
  );
}

/** The 1 to 5 stars and an optional comment for the broker who found this home. */
export function RateBrokerDialog({
  tenancy,
  isOpen,
  onOpenChange,
}: {
  tenancy: TenancyDetail;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const broker = tenancy.broker;
  const [stars, setStars] = useState(broker?.rating?.stars ?? 0);
  const [comment, setComment] = useState(broker?.rating?.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const setOpen = onOpenChange;
  const open = isOpen;
  if (!broker) return null;
  return (
    <FormDialog
      isOpen={open}
      onOpenChange={setOpen}
      title={`Rate ${broker.name ?? "your broker"}`}
      submitLabel="Save rating"
      isPending={pending}
      formError={error}
      onSubmit={(event) => {
        event.preventDefault();
        if (stars < 1) return setError("Pick 1 to 5 stars.");
        start(async () => {
          const r = await rateBrokerAsTenant(tenancy.id, { stars, comment: comment.trim() || null });
          if (!r.ok) return setError(r.error);
          setOpen(false);
          toast.success("Thank you. Your rating is saved.");
          router.refresh();
        });
      }}
    >
      <StarInput
        value={stars}
        onChange={(n) => {
          setStars(n);
          setError(null);
        }}
      />
      <TextInput
        label="Comment"
        name="comment"
        value={comment}
        onChange={setComment}
        multiline
        description="Optional."
      />
    </FormDialog>
  );
}
