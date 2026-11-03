import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Dock,
  KeyValue,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Timeline,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useReportSaved } from "./data";
import type { ReportSavedView } from "./types";
import { Bones, backOr, StateHero } from "./ui";

/**
 * `hk-report-saved`, X3: an honest offline confirmation. The report is safe on the phone, the ticket
 * number arrives later, and the outbox shows it waiting.
 */
export function ReportSavedScreen() {
  const query = useReportSaved();
  const saved = query.data;
  return (
    <Screen
      header={<NavBar title="" onBack={() => backOr(href("hk-today"))} />}
      dock={
        saved ? (
          <Dock>
            <View className="flex-row gap-2.5">
              <Button
                variant="secondary"
                icon="ArrowRotateRight"
                className="flex-1"
                onPress={() => router.push(href("shared-outbox"))}
              >
                Try now
              </Button>
              <Button className="flex-1" onPress={() => router.dismissTo(href("hk-today"))}>
                Back to today
              </Button>
            </View>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={saved} loading={<SavedLoading />}>
        {(view) => <SavedBody saved={view} />}
      </QueryView>
    </Screen>
  );
}

function SavedBody({ saved }: { saved: ReportSavedView }) {
  return (
    <View>
      <StateHero
        icon="FloppyDisk"
        tone="warning"
        title="Saved on this phone"
        body="No signal right now. Your report is safe here and gets a ticket number when it reaches maintenance."
      />
      <Card className="mx-4 mt-5" padding="sm">
        <KeyValue
          rows={[
            { label: "Problem", value: saved.problem },
            { label: "Urgency", value: saved.urgency },
            { label: "Photo", value: saved.photo },
          ]}
        />
      </Card>
      <Card className="mx-4 mt-3">
        <Timeline
          steps={[
            { title: "Saved on this phone", detail: saved.savedAt, state: "done" },
            {
              title: "Sends to maintenance",
              detail: "Automatically, as soon as there is signal",
              state: "now",
              icon: "PaperPlane",
            },
            {
              title: "Ticket number",
              detail: saved.ticket ?? "Given when it arrives · Beatrice gets a copy",
              state: saved.ticket ? "done" : "todo",
              icon: "FileText",
            },
          ]}
        />
      </Card>
    </View>
  );
}

function SavedLoading() {
  return (
    <LoadingView label="Loading">
      <View className="items-center gap-3">
        <LoadingBone className="size-24 rounded-3xl" />
        <LoadingBone className="h-8 w-56" />
        <LoadingBone className="h-4 w-64" />
      </View>
      <Bones>
        <LoadingBone className="h-32 rounded-3xl" />
        <LoadingBone className="h-44 rounded-3xl" />
      </Bones>
    </LoadingView>
  );
}
