import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Dock,
  KeyValue,
  LoadingBone,
  metrics,
  NavBar,
  Photo,
  Screen,
  StepBar,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useAcceptDeductions, useAnswerDeduction, useMoveOut } from "./data";
import type { Deduction, DeductionStatus, MoveOutView } from "./types";
import { backOr, CardBone, Eyebrow, Skeleton, useNotify } from "./ui";

/** Each answer's chip: the word says it, the colour repeats it. */
const ANSWERED = {
  accepted: { label: "Accepted", tone: "success", icon: "Check" },
  disputed: { label: "Disputed", tone: "warning", icon: "ScalesUnbalanced" },
} as const;

/**
 * `res-moveout` (R5): the deposit settlement. Each deduction shows its move-in and move-out evidence
 * and is accepted or disputed on its own; the refund amount is never hidden. "Accept all" accepts
 * what is not disputed and sends the settlement to Solange for the refund.
 */
export function MoveOutScreen() {
  const query = useMoveOut();
  const acceptAll = useAcceptDeductions();
  const notify = useNotify();
  const view = query.data;
  const disputed = view?.deductions.some((d) => d.status === "disputed") ?? false;

  const send = () =>
    acceptAll.mutate(undefined, {
      onSuccess: () => notify.done("Sent to Solange. You hear when the refund is on its way.", "PaperPlane"),
      onError: notify.failed,
    });

  return (
    <Screen
      header={<NavBar title="Moving out" subtitle="Deposit settlement" onBack={() => backOr(href("res-lease"))} />}
      dock={
        view ? (
          <Dock note={view.refundTo}>
            <Button size="lg" isDisabled={view.submitted || acceptAll.isPending} onPress={send}>
              {view.submitted
                ? "Sent to Solange for approval"
                : disputed
                  ? "Accept the rest and send"
                  : "Accept all and get refund"}
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={view} loading={<MoveOutSkeleton />}>
        {(data) => <Settlement view={data} />}
      </QueryView>
    </Screen>
  );
}

function Settlement({ view }: { view: MoveOutView }) {
  const disputed = view.deductions.filter((d) => d.status === "disputed");
  return (
    <View className="gap-4 px-4">
      <View className="gap-2">
        <StepBar total={view.stages.length} step={view.step} />
        <View className="flex-row flex-wrap items-center gap-x-1.5">
          {view.stages.map((stage, index) => (
            <View key={stage.label} className="flex-row items-center gap-1.5">
              {index > 0 ? (
                <Text role="caption" tone="muted">
                  ·
                </Text>
              ) : null}
              <Text
                role="caption"
                strong={stage.state !== "todo"}
                tone={stage.state === "done" ? "success" : stage.state === "now" ? "accent" : "muted"}
                accessibilityLabel={`${stage.label}, ${stage.state === "done" ? "done" : stage.state === "now" ? "now" : "next"}`}
              >
                {stage.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Card padding="sm">
        <KeyValue
          rows={[
            { label: "Deposit held", value: rwf(view.held) },
            { label: "Proposed deductions", value: `− ${rwf(view.deducted)}`, tone: "danger" },
          ]}
          total={{ label: "Refund to you", value: rwf(view.refund) }}
        />
      </Card>

      {view.submitted ? (
        <Banner
          tone="success"
          icon="PaperPlane"
          title="Settlement sent to Solange"
          body="Once she approves, the refund goes to your MTN MoMo. You get a receipt like a rent payment."
        />
      ) : disputed.length > 0 ? (
        <Banner
          tone="warning"
          icon="ScalesUnbalanced"
          title={`You disputed ${disputed.length === 1 ? "1 deduction" : `${disputed.length} deductions`}`}
          body="Solange looks at the photos again and answers before any refund is sent."
        />
      ) : null}

      <Eyebrow>Check each deduction</Eyebrow>
      {view.deductions.map((d) => (
        <DeductionCard key={d.id} deduction={d} locked={view.submitted} />
      ))}
    </View>
  );
}

/** One deduction: what and how much, the evidence, and its own accept or dispute. */
function DeductionCard({ deduction, locked }: { deduction: Deduction; locked: boolean }) {
  const answer = useAnswerDeduction();
  const notify = useNotify();
  const set = (status: DeductionStatus) => answer.mutate({ id: deduction.id, status }, { onError: notify.failed });
  const evidence = deduction.evidence;
  const answered = deduction.status === "pending" ? null : ANSWERED[deduction.status];
  return (
    <Card padding="sm">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text role="headline" className="flex-1">
          {deduction.title}
        </Text>
        <Text role="headline" strong tabular>
          {deduction.amount.toLocaleString("en-US")}
        </Text>
      </View>

      {evidence.kind === "photos" ? (
        <View className="mt-2 flex-row gap-1.5">
          <Photo
            source={evidence.before}
            height={metrics.photo.thumb}
            radius="sm"
            className="flex-1"
            label={`${deduction.title}, at move-in`}
            bottom={<Chip variant="glass" label="Move-in" />}
          />
          <Photo
            source={evidence.after}
            height={metrics.photo.thumb}
            radius="sm"
            className="flex-1"
            label={`${deduction.title}, at move-out`}
            bottom={<Chip variant="glass" label="Move-out" />}
          />
        </View>
      ) : (
        <View className="mt-2 flex-row items-center gap-3">
          <Photo
            source={evidence.photo}
            width={metrics.thumb}
            height={metrics.thumb}
            radius="sm"
            label="The water meter"
          />
          <Text role="caption" tone="muted" className="flex-1">
            {evidence.reading}
          </Text>
          {answered ? <Chip label={answered.label} tone={answered.tone} icon={answered.icon} /> : null}
        </View>
      )}

      {evidence.kind === "photos" ? (
        answered ? (
          <View className="mt-3 flex-row items-center justify-between gap-3">
            <Chip label={answered.label} tone={answered.tone} icon={answered.icon} />
            {locked ? null : (
              <Button size="sm" variant="ghost" onPress={() => set("pending")}>
                Change my answer
              </Button>
            )}
          </View>
        ) : (
          <View className="mt-3 flex-row gap-2.5">
            <Button variant="secondary" className="flex-1" isDisabled={locked} onPress={() => set("disputed")}>
              Dispute
            </Button>
            <Button variant="outline" className="flex-1" isDisabled={locked} onPress={() => set("accepted")}>
              Accept
            </Button>
          </View>
        )
      ) : null}
    </Card>
  );
}

function MoveOutSkeleton() {
  return (
    <Skeleton label="Loading the deposit settlement">
      <LoadingBone className="h-1 rounded-full" />
      <LoadingBone className="h-4 w-4/5" />
      <CardBone />
      <LoadingBone className="h-3 w-2/5" />
      <LoadingBone className="h-52 rounded-3xl" />
      <CardBone />
    </Skeleton>
  );
}
