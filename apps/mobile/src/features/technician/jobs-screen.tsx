import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Card,
  Chip,
  EmptyView,
  FilterChips,
  Icon,
  IconButton,
  ListGroup,
  LoadingBone,
  LoadingView,
  Screen,
  ScreenHeader,
  Section,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useJobsBoard } from "./data";
import type { JobRow, JobsBoard } from "./types";
import { JobRowItem } from "./ui";

type JobFilter = "todo" | "parts" | "done";

/**
 * `tech-jobs`, S9: a repeat-fault alert leads, then Jean-Paul's jobs sorted by urgency, with the jobs
 * waiting for parts shown apart and today's finished ones behind their own filter.
 */
export function JobsScreen() {
  const query = useJobsBoard();
  const [shown, setShown] = useState<JobFilter>("todo");
  return (
    <Screen>
      <QueryView query={query} data={query.data} loading={<JobsLoading />}>
        {(board) => <Board board={board} shown={shown} onShow={setShown} />}
      </QueryView>
    </Screen>
  );
}

const openJob = (job: string) => router.push(href("tech-job", { job }));

function Board({ board, shown, onShow }: { board: JobsBoard; shown: JobFilter; onShow: (v: JobFilter) => void }) {
  const header = (
    <ScreenHeader
      eyebrow={board.eyebrow}
      title="My jobs"
      right={
        <IconButton
          icon="Bell"
          label="Notifications"
          variant="surface"
          dot
          onPress={() => router.push(href("shared-notifs", undefined, { app: "technician" }))}
        />
      }
    />
  );
  if (board.todo.length + board.parts.length + board.done.length === 0)
    return (
      <View className="flex-1">
        {header}
        <EmptyView
          icon="Wrench"
          title="No jobs right now"
          body="Work orders from housekeeping and the front desk land here, the most urgent first."
          action={{ label: "Scan a tag", icon: "QrCode", onPress: () => router.navigate(href("tech-scan")) }}
        />
      </View>
    );
  const options = [
    { value: "todo", label: `To do · ${board.todo.length}` },
    { value: "parts", label: `Waiting parts · ${board.parts.length}` },
    { value: "done", label: `Done today · ${board.done.length}` },
  ] as const;
  return (
    <View>
      {header}
      {board.alert ? <RepeatFault alert={board.alert} /> : null}
      <View className="mt-3">
        <FilterChips label="Show jobs" options={options} value={shown} onChange={onShow} />
      </View>
      {shown === "todo" ? (
        <>
          <Section title="To do" detail="most urgent first" />
          {board.todo.length > 0 ? (
            <Rows rows={board.todo} />
          ) : (
            <Text role="callout" tone="muted" className="px-4">
              Nothing to do right now. New work orders land here.
            </Text>
          )}
        </>
      ) : null}
      {shown !== "done" && board.parts.length > 0 ? (
        <>
          <Section title="Waiting for parts" detail={board.partsNote} />
          <Rows rows={board.parts} />
        </>
      ) : null}
      {shown === "parts" && board.parts.length === 0 ? (
        <Text role="callout" tone="muted" className="px-4 pt-5">
          No job is waiting for parts.
        </Text>
      ) : null}
      {shown === "done" ? (
        <>
          <Section title="Done today" detail={`${board.done.length} fixed`} />
          {board.done.length > 0 ? (
            <Rows rows={board.done} />
          ) : (
            <Text role="callout" tone="muted" className="px-4">
              Nothing finished yet today.
            </Text>
          )}
        </>
      ) : null}
    </View>
  );
}

function Rows({ rows }: { rows: readonly JobRow[] }) {
  return (
    <ListGroup className="mx-4">
      {rows.map((row) => (
        <JobRowItem key={row.id} row={row} onPress={() => openJob(row.id)} />
      ))}
    </ListGroup>
  );
}

/** `.card.tint-bad`: the third fault on one unit this month, a link to its history. */
function RepeatFault({ alert }: { alert: NonNullable<JobsBoard["alert"]> }) {
  return (
    <Card
      tone="danger"
      className="mx-4"
      onPress={() => router.push(href("tech-asset", { tag: alert.tag }), { withAnchor: true })}
      accessibilityLabel={`${alert.title}. ${alert.body} See history`}
    >
      <View className="flex-row items-start gap-3">
        <Icon name="TriangleExclamation" size={24} />
        <View className="flex-1 gap-1">
          <Text role="headline">{alert.title}</Text>
          <Text role="callout" tone="muted">
            {alert.body}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between">
        <Chip label="Repeat fault" tone="danger" icon="ChartLine" />
        <View className="flex-row items-center gap-1">
          <Text role="callout" strong>
            See history
          </Text>
          <Icon name="ChevronRight" size={12} />
        </View>
      </View>
    </Card>
  );
}

function JobsLoading() {
  return (
    <LoadingView label="Loading your jobs" className="px-4 pt-2">
      <View className="gap-2">
        <LoadingBone className="h-3 w-40" />
        <LoadingBone className="h-7 w-32" />
      </View>
      <LoadingBone className="h-36 rounded-3xl" />
      <View className="flex-row gap-2">
        <LoadingBone className="h-9 w-24 rounded-full" />
        <LoadingBone className="h-9 w-32 rounded-full" />
        <LoadingBone className="h-9 w-28 rounded-full" />
      </View>
      <LoadingBone className="h-4 w-20" />
      <LoadingBone className="h-36 rounded-3xl" />
      <LoadingBone className="h-4 w-36" />
      <LoadingBone className="h-36 rounded-3xl" />
    </LoadingView>
  );
}
