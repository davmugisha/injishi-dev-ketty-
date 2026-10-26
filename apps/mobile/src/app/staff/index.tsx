import { screenHref } from "@injishi/data";
import type { HousekeepingDone, HousekeepingTask } from "@injishi/data/fixtures/platform";
import { Link } from "expo-router";
import { Avatar, Button, Card, Chip, ListGroup, Separator } from "heroui-native";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { deleteDocument, getCollection, saveDocument } from "@/lib/store";
import { toneColor } from "@/lib/tone";

/** Staff · my tasks (artifact: StaffToday.dc.html) — the housekeeper's rooms for today, from the device database. */
export default function StaffTodayScreen() {
  const { persona } = useSession();
  const [, setVersion] = useState(0);
  const tasks = getCollection<HousekeepingTask>("platform.housekeepingTasks");
  const done = getCollection<HousekeepingDone>("platform.housekeepingDone");
  const total = tasks.length + done.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;

  const update = useCallback((task: HousekeepingTask, status: "active" | "done") => {
    if (status === "active") saveDocument("platform.housekeepingTasks", { ...task, status: "active" });
    else {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      saveDocument<HousekeepingDone>("platform.housekeepingDone", {
        id: task.id,
        room: task.room,
        kind: task.kind,
        when: `Cleaned ${time} · waiting for inspection`,
        state: "Clean",
        stateTone: "success",
      });
      deleteDocument("platform.housekeepingTasks", task.id);
    }
    setVersion((v) => v + 1);
  }, []);

  return (
    <>
      <PhoneTop>
        <Avatar size="sm" variant="soft" color="accent" alt={persona?.name ?? ""}>
          <Avatar.Fallback>{persona?.initials}</Avatar.Fallback>
        </Avatar>
        <View className="flex-1">
          <Text className="text-[13px] leading-[18px] font-semibold text-foreground">{persona?.name}</Text>
          <Text className="text-xs leading-4 text-muted">Housekeeping · Floor 2 · Isangano</Text>
        </View>
        <Link href={screenHref("StaffReport") as never} asChild>
          <Button variant="ghost" isIconOnly accessibilityLabel="Report a problem">
            <Icon name="TriangleExclamation" />
          </Button>
        </Link>
      </PhoneTop>

      <PhoneBody>
        <Card className="gap-3 p-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="gap-1">
              <Text className="text-xs text-muted">Monday 12 October</Text>
              <Text className="text-xl leading-[26px] font-semibold text-foreground">
                {done.length} of {total} rooms done
              </Text>
            </View>
            <Chip color="success" variant="soft">
              <View className="size-2 rounded-full bg-success" />
              <Chip.Label>In since 07:02</Chip.Label>
            </Chip>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Rooms done today"
            accessibilityValue={{ min: 0, max: 100, now: pct }}
            className="h-2 overflow-hidden rounded-full bg-default"
          >
            <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </View>
          <Text className="text-xs leading-4 text-muted">Shift 07:00 – 15:00 · Break 11:30</Text>
        </Card>

        <View className="gap-2.5">
          <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
            Next
          </Text>
          {tasks.map((t) => (
            <Card key={t.id} className="gap-2.5 px-4 py-3.5">
              <View className="flex-row items-start gap-3">
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xl leading-[26px] font-semibold text-foreground">{t.room}</Text>
                    <Chip variant="soft" color={toneColor(t.kindTone)}>
                      <Chip.Label>{t.kind}</Chip.Label>
                    </Chip>
                  </View>
                  <Text className="text-[13px] leading-[18px] text-muted">{t.note}</Text>
                </View>
                {t.flag ? (
                  <Chip color="warning" variant="soft">
                    <Icon name="Clock" size={12} tone="warning-soft-foreground" />
                    <Chip.Label>{t.flag}</Chip.Label>
                  </Chip>
                ) : null}
              </View>
              <View className="flex-row items-center gap-2">
                <Button
                  size="lg"
                  className="min-h-14 flex-1"
                  onPress={() => update(t, t.status === "active" ? "done" : "active")}
                >
                  {t.status === "active" ? <Icon name="Check" tone="accent-foreground" /> : null}
                  <Button.Label>{t.status === "active" ? "Mark clean" : "Start cleaning"}</Button.Label>
                </Button>
                <Link href={screenHref("StaffTask") as never} asChild>
                  <Button
                    variant="secondary"
                    size="lg"
                    isIconOnly
                    className="min-h-14 w-14"
                    accessibilityLabel={`Open room ${t.room} checklist`}
                  >
                    <Icon name="ListCheck" size={20} />
                  </Button>
                </Link>
              </View>
            </Card>
          ))}
        </View>

        <View className="gap-2">
          <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
            Done today
          </Text>
          <ListGroup>
            {done.map((d, i) => (
              <View key={d.id}>
                {i > 0 ? <Separator className="mx-4" /> : null}
                <ListGroup.Item>
                  <ListGroup.ItemPrefix>
                    <Icon name="CircleCheckFill" tone="success" />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle>{`Room ${d.room} · ${d.kind}`}</ListGroup.ItemTitle>
                    <ListGroup.ItemDescription>{d.when}</ListGroup.ItemDescription>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix>
                    <Chip variant="soft" color={toneColor(d.stateTone)}>
                      <Chip.Label>{d.state}</Chip.Label>
                    </Chip>
                  </ListGroup.ItemSuffix>
                </ListGroup.Item>
              </View>
            ))}
          </ListGroup>
        </View>
      </PhoneBody>
    </>
  );
}
