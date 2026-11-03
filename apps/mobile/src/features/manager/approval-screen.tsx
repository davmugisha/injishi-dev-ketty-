import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Dialog,
  Dock,
  EmptyView,
  Field,
  KeyValue,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Text,
  TextArea,
  Timeline,
  type TimelineState,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useApproval, useDecide, useManagerMe } from "./data";
import type { ApprovalDetail } from "./types";
import { Eyebrow, RowBones } from "./ui";

/**
 * Approval detail (prototype `mgr-approval`, a refund by default; `?id=` opens any request): the
 * figure and its checks, the evidence and the policy, then what happens after the tap. Approve sits
 * last and asks for a fingerprint or the PIN; Decline asks for a reason. Either goes back to the
 * list with the request under Done today.
 */
export function ApprovalScreen() {
  const { id } = useScreenParams("mgr-approval");
  const query = useApproval(id);
  const me = useManagerMe();
  const decide = useDecide();
  const toast = useToast();
  const [asking, setAsking] = useState<"approve" | "decline" | null>(null);
  const [reason, setReason] = useState("");
  const detail = query.data;
  const waiting = detail?.state === "waiting";
  const withPin = me.data?.confirmWith === "pin";

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(href("mgr-approvals"));
  };

  const finish = (approve: boolean) => {
    if (!detail) return;
    decide.mutate(
      { id: detail.id, approve, reason: approve ? undefined : reason },
      {
        onSuccess: () => {
          setAsking(null);
          setReason("");
          toast.show({
            icon: approve ? "CircleCheck" : "CircleXmark",
            message: `${approve ? detail.approvedWord : "Declined"} · ${detail.title}`,
          });
          router.navigate(href("mgr-approvals"));
        },
      },
    );
  };

  return (
    <Screen
      header={<NavBar title={detail?.heading ?? "Request"} subtitle={detail?.askedBy} onBack={back} />}
      dock={
        waiting && detail ? (
          <Dock note="Confirm with your fingerprint or PIN. Decline asks you for a reason.">
            <View className="flex-row gap-2.5">
              <Button variant="secondary" size="lg" className="flex-1" onPress={() => setAsking("decline")}>
                {detail.declineLabel}
              </Button>
              <Button
                size="lg"
                icon={withPin ? "Lock" : "Fingerprint"}
                className="flex-1"
                onPress={() => setAsking("approve")}
              >
                {detail.approveLabel}
              </Button>
            </View>
          </Dock>
        ) : undefined
      }
    >
      <QueryView
        query={query}
        data={detail}
        loading={
          <LoadingView label="Loading the request" className="px-4 pt-2">
            <LoadingBone className="h-36 rounded-3xl" />
            <LoadingBone className="h-3 w-20" />
            <RowBones rows={4} />
            <LoadingBone className="h-3 w-28" />
            <LoadingBone className="h-40 rounded-3xl" />
          </LoadingView>
        }
      >
        {(found) =>
          found ? (
            <Body detail={found} />
          ) : (
            <EmptyView
              icon="CheckDouble"
              title="This request is no longer here"
              body="It was decided or withdrawn. Everything waiting on you is in Approvals."
              action={{ label: "Open approvals", onPress: () => router.navigate(href("mgr-approvals")) }}
            />
          )
        }
      </QueryView>

      {detail ? (
        <>
          <Dialog
            isOpen={asking === "approve"}
            onClose={() => setAsking(null)}
            icon={withPin ? "Lock" : "Fingerprint"}
            title={withPin ? "Enter your PIN to confirm" : "Confirm with your fingerprint"}
            body={`${detail.title} · ${detail.figureNote}`}
            actions={
              <>
                <Button isDisabled={decide.isPending} onPress={() => finish(true)}>
                  {withPin ? "Confirm with PIN" : "Touch to confirm"}
                </Button>
                <Button variant="ghost" onPress={() => setAsking(null)}>
                  Cancel
                </Button>
              </>
            }
          />
          <Dialog
            isOpen={asking === "decline"}
            onClose={() => setAsking(null)}
            icon="CircleXmark"
            tone="danger"
            title={`${detail.declineLabel}?`}
            body="The person who asked sees your reason."
            actions={
              <>
                <Button
                  variant="danger"
                  isDisabled={reason.trim().length < 3 || decide.isPending}
                  onPress={() => finish(false)}
                >
                  {detail.declineLabel}
                </Button>
                <Button variant="ghost" onPress={() => setAsking(null)}>
                  Cancel
                </Button>
              </>
            }
          >
            <View className="self-stretch">
              <Field label="Reason">
                <TextArea value={reason} onChangeText={setReason} placeholder="Outside the cancellation policy" />
              </Field>
            </View>
          </Dialog>
        </>
      ) : null}
    </Screen>
  );
}

/** Before the tap the first step is now; once approved it is done and the next one is under way. */
function stepState(approved: boolean, index: number): TimelineState {
  if (!approved) return index === 0 ? "now" : "todo";
  return index === 0 ? "done" : index === 1 ? "now" : "todo";
}

function Body({ detail }: { detail: ApprovalDetail }) {
  const decided = detail.state === "approved" || detail.state === "declined";
  return (
    <View className="gap-4 px-4 pt-2">
      {decided ? (
        <Banner
          tone={detail.state === "approved" ? "success" : "default"}
          title={`${detail.state === "approved" ? detail.approvedWord : "Declined"} at ${detail.decidedAt ?? ""}`}
          body={detail.reason ? `Reason: ${detail.reason}` : "It is listed under Done today."}
        />
      ) : null}
      <Card>
        <Text role="micro" tone="muted" caps strong>
          {detail.kicker}
        </Text>
        <Text role="display" tabular className="mt-1">
          {detail.figure}
        </Text>
        <Text role="callout" tone="muted" className="mt-1">
          {detail.figureNote}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {detail.checks.map((check) => (
            <Chip key={check.label} tone="success" icon={check.icon} label={check.label} />
          ))}
        </View>
      </Card>
      <View className="gap-2">
        <Eyebrow>Evidence</Eyebrow>
        <Card padding="sm">
          <KeyValue rows={detail.evidence} />
        </Card>
      </View>
      {detail.state === "declined" ? null : (
        <View className="gap-2">
          <Eyebrow>{decided ? "What happens now" : `After you ${detail.approveLabel.toLowerCase()}`}</Eyebrow>
          <Card>
            <Timeline steps={detail.after.map((step, index) => ({ ...step, state: stepState(decided, index) }))} />
          </Card>
        </View>
      )}
    </View>
  );
}
