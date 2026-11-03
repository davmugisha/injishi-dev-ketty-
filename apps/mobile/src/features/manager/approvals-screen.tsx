import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  EmptyView,
  ListGroup,
  LoadingBone,
  LoadingView,
  Screen,
  ScreenHeader,
  Section,
  Segmented,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useApprovals } from "./data";
import type { Approval, ApprovalGroup } from "./types";
import { ApprovalRow, RowBones } from "./ui";

const GROUPS: readonly { group: ApprovalGroup; title: string }[] = [
  { group: "rooms", title: "Rooms" },
  { group: "money", title: "Money" },
  { group: "people", title: "People" },
];

type Tab = "waiting" | "done";

/**
 * Approvals (prototype `mgr-approvals`): what waits on Aline, grouped by what is at stake (rooms,
 * money, people), each opening its evidence. Requests above her limit show as waiting on the owner,
 * so nothing is silently stuck. Done today lists what she decided and how.
 */
export function ApprovalsScreen() {
  const query = useApprovals();
  const [tab, setTab] = useState<Tab>("waiting");
  const open = (approval: Approval) => router.push(href("mgr-approval", { id: approval.id }));
  const view = query.data;

  return (
    <Screen>
      <ScreenHeader title="Approvals" subtitle={view ? `${view.place} · your limit ${view.limit}` : undefined} />
      <QueryView
        query={query}
        data={view}
        loading={
          <LoadingView label="Loading approvals" className="px-4 pt-1">
            <LoadingBone className="h-12 rounded-2xl" />
            <LoadingBone className="h-5 w-20" />
            <RowBones rows={1} />
            <LoadingBone className="h-5 w-20" />
            <RowBones rows={2} />
            <LoadingBone className="h-5 w-20" />
            <RowBones rows={1} />
          </LoadingView>
        }
      >
        {(approvals) => {
          if (approvals.waiting.length + approvals.owner.length + approvals.done.length === 0) {
            return (
              <EmptyView
                icon="CheckDouble"
                title="Nothing to approve"
                body="Refunds, discounts, room releases and leave from your team land here, grouped by what is at stake."
                action={{
                  label: "Back to today",
                  icon: "ChartColumn",
                  onPress: () => router.navigate(href("mgr-today")),
                }}
              />
            );
          }
          return (
            <View>
              <View className="px-4 pt-1">
                <Segmented
                  label="Approvals"
                  options={[
                    { value: "waiting", label: `Waiting · ${approvals.waiting.length}` },
                    { value: "done", label: `Done today · ${approvals.done.length}` },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
              </View>
              {tab === "waiting" ? (
                <>
                  {GROUPS.map(({ group, title }) => {
                    const rows = approvals.waiting.filter((a) => a.group === group);
                    if (rows.length === 0) return null;
                    return (
                      <Section key={group} title={title}>
                        <ListGroup className="mx-4">
                          {rows.map((approval) => (
                            <ApprovalRow key={approval.id} approval={approval} onOpen={() => open(approval)} />
                          ))}
                        </ListGroup>
                      </Section>
                    );
                  })}
                  {approvals.waiting.length === 0 ? (
                    <View className="px-8 pt-8">
                      <Text role="callout" tone="muted" className="text-center">
                        Nothing waits on you. Everything you decided today is under Done today.
                      </Text>
                    </View>
                  ) : null}
                  {approvals.owner.length > 0 ? (
                    <Section title="Waiting on others">
                      <ListGroup className="mx-4">
                        {approvals.owner.map((approval) => (
                          <ApprovalRow key={approval.id} approval={approval} />
                        ))}
                      </ListGroup>
                    </Section>
                  ) : null}
                </>
              ) : (
                <Section title="Decided today">
                  <ListGroup className="mx-4">
                    {approvals.done.map((approval) => (
                      <ApprovalRow key={approval.id} approval={approval} />
                    ))}
                  </ListGroup>
                </Section>
              )}
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}
