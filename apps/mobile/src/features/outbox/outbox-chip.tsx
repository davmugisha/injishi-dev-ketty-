import { router } from "expo-router";
import { Chip, PressArea } from "@/components/ui";
import { useOutboxSummary } from "@/data/outbox";
import { useSession } from "@/lib/session";

/**
 * The header's outbox chip (mobile spec 0003, AC-8): "N waiting" in warning tone, "N not sent" in danger
 * tone when any write was refused, else "All sent". It opens the outbox.
 */
export function OutboxChip() {
  const { account } = useSession();
  const { chip, waiting } = useOutboxSummary(account?.userId);
  const icon = chip.tone === "success" ? "CloudCheck" : chip.tone === "danger" ? "CircleExclamation" : "CloudSlash";
  return (
    <PressArea
      onPress={() => router.push("/outbox")}
      accessibilityRole="button"
      accessibilityLabel={`${chip.label}. Open what is on this phone.`}
      accessibilityState={{ busy: waiting > 0 }}
      className="justify-center"
    >
      <Chip label={chip.label} tone={chip.tone} icon={icon} />
    </PressArea>
  );
}
