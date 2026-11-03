import { router } from "expo-router";
import { Share, View } from "react-native";
import { Banner, Card, IconButton, Kpi, LoadingBone, LoadingView, NavBar, Screen, Text } from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useFlash } from "./data";
import type { FlashView } from "./types";
import { KpiBones, ShareBar, WeekColumns } from "./ui";

/** The report as one message, for the share sheet. */
function asText(flash: FlashView): string {
  return [
    `Flash report · ${flash.day}`,
    `Room revenue, both properties: ${flash.revenue}`,
    flash.sold,
    ...flash.properties.map((p) => `${p.name}: ${p.value} (${p.caption})`),
    `RevPAR ${flash.revpar.value}${flash.revpar.unit} · F&B ${flash.fnb.value}${flash.fnb.unit}`,
    `Money in: ${flash.methods.map((m) => `${m.name} ${m.share}%`).join(", ")}`,
    flash.openAudit ? `${flash.openAudit.title}. ${flash.openAudit.body}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Flash report (prototype `mgr-flash`): yesterday's numbers for both properties, read in under a
 * minute at 07:30. Room revenue and its week, each property's occupancy, RevPAR and F&B, money in by
 * method, and a plain line when a property's night audit is still open. The arrow shares it.
 */
export function FlashScreen() {
  const query = useFlash();
  const flash = query.data;

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(href("mgr-today"));
  };

  return (
    <Screen
      header={
        <NavBar
          title="Flash report"
          subtitle={flash?.day}
          onBack={back}
          right={
            flash ? (
              <IconButton
                icon="ArrowUpRight"
                label="Share the report"
                variant="plain"
                onPress={() => void Share.share({ message: asText(flash) }).catch(() => {})}
              />
            ) : null
          }
        />
      }
    >
      <QueryView
        query={query}
        data={flash}
        loading={
          <LoadingView label="Loading yesterday's report" className="px-4 pt-2">
            <LoadingBone className="h-60 rounded-3xl" />
            <KpiBones />
            <KpiBones />
            <LoadingBone className="h-40 rounded-3xl" />
          </LoadingView>
        }
      >
        {(report) => (
          <View className="gap-4 px-4 pt-2">
            <Card>
              <Text role="micro" tone="muted" caps strong>
                Room revenue · both properties
              </Text>
              <Text role="display" tabular className="mt-1">
                {report.revenue}
              </Text>
              <Text role="callout" tone="muted" className="mt-1">
                {report.sold}
              </Text>
              <View className="mt-3">
                <WeekColumns week={report.week} />
              </View>
            </Card>

            <View className="gap-2.5">
              <View className="flex-row gap-2.5">
                {report.properties.map((p) => (
                  <View key={p.name} className="flex-1">
                    <Kpi label={p.name} value={p.value} caption={p.caption} />
                  </View>
                ))}
              </View>
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <Kpi
                    label="RevPAR"
                    value={report.revpar.value}
                    unit={report.revpar.unit}
                    caption={report.revpar.caption}
                  />
                </View>
                <View className="flex-1">
                  <Kpi label="F&B" value={report.fnb.value} unit={report.fnb.unit} caption={report.fnb.caption} />
                </View>
              </View>
            </View>

            <Card>
              <Text role="headline" className="mb-2">
                Money in, by method
              </Text>
              {report.methods.map((m) => (
                <ShareBar key={m.name} name={m.name} share={m.share} />
              ))}
            </Card>

            {report.openAudit ? (
              <Banner
                tone="warning"
                icon="TriangleExclamation"
                title={report.openAudit.title}
                body={report.openAudit.body}
              />
            ) : null}
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
