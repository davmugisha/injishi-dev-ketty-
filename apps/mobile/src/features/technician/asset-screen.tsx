import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Dock,
  Icon,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  Photo,
  Screen,
  Section,
  Text,
  Timeline,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useAskStore, useAsset, useCreateJob } from "./data";
import type { Asset } from "./types";
import { backTo, StatTile } from "./ui";

/** The tag the prototype draws when none is named: the AC unit in 305. */
const SAMPLE_TAG = "AST-0305-AC";

/**
 * `tech-asset`, S8 + S9: one unit's fault history, a rule-based suggestion with the store's stock, and
 * a new work order filled in from the unit.
 */
export function AssetScreen() {
  const { tag } = useScreenParams("tech-asset");
  const query = useAsset(tag ?? SAMPLE_TAG);
  const data = query.data;
  return (
    <Screen
      header={<NavBar title={data?.name ?? "Asset"} subtitle={data?.subtitle} onBack={() => backTo("tech-scan")} />}
      dock={data ? <AssetDock asset={data} /> : undefined}
    >
      <QueryView query={query} data={data} loading={<AssetLoading />}>
        {(asset) => <AssetBody asset={asset} />}
      </QueryView>
    </Screen>
  );
}

const STOCK_TONE = { danger: "danger", warning: "warning", success: "success" } as const;

function AssetBody({ asset }: { asset: Asset }) {
  return (
    <View>
      <View className="px-4">
        <Photo
          source={asset.photo}
          height={metrics.photo.banner}
          focus="top"
          label={`${asset.name}, ${asset.where}`}
          bottom={
            <View className="flex-row">
              <Chip variant="glass" icon="MapPin" label={asset.where} />
            </View>
          }
        />
      </View>
      <View className="mt-3 flex-row gap-2 px-4">
        {asset.stats.map((stat) => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} caption={stat.caption} tone={stat.tone} />
        ))}
      </View>
      {asset.suggestion ? (
        <Card tone="warning" className="mx-4 mt-3">
          <View className="flex-row items-center gap-1.5">
            <Icon name="Bulb" size={12} />
            <Text role="caption" strong>
              Suggestion · rule based
            </Text>
          </View>
          <Text role="headline" className="mt-1">
            {asset.suggestion.title}
          </Text>
          <Text role="callout" tone="muted" className="mt-1">
            {asset.suggestion.body}
          </Text>
          <View className="mt-2 flex-row flex-wrap items-center gap-1">
            <Icon name="Box" size={12} tone={STOCK_TONE[asset.suggestion.stock.tone]} />
            <Text role="caption" strong tone={STOCK_TONE[asset.suggestion.stock.tone]}>
              {asset.suggestion.stock.label}
            </Text>
            <Text role="caption" tone="muted">
              {`· ${asset.suggestion.stock.hint}`}
            </Text>
          </View>
        </Card>
      ) : null}
      <Section title="History" />
      <Card className="mx-4">
        {asset.history.length > 0 ? (
          <Timeline
            steps={asset.history.map((h) => ({ key: h.key, title: h.title, detail: h.detail, state: "done" as const }))}
          />
        ) : (
          <Text role="callout" tone="muted">
            No faults on this unit yet.
          </Text>
        )}
      </Card>
    </View>
  );
}

function AssetDock({ asset }: { asset: Asset }) {
  const ask = useAskStore();
  const create = useCreateJob();
  const toast = useToast();
  const newJob = () =>
    create.mutate(asset.tag, {
      onSuccess: ({ job }) => router.push(href("tech-job", { job }), { withAnchor: true }),
    });
  const askPatrick = () =>
    ask.mutate(asset.tag, { onSuccess: ({ message }) => toast.show({ icon: "Box", message, haptic: "success" }) });
  return (
    <Dock>
      {/* The new work order is the main step: it takes the width the store request leaves. */}
      <View className="flex-row gap-2.5">
        {asset.suggestion ? (
          <Button
            variant="secondary"
            size="md"
            icon="Box"
            isDisabled={asset.suggestion.asked || ask.isPending}
            onPress={askPatrick}
          >
            {asset.suggestion.asked ? "Patrick asked" : "Ask Patrick"}
          </Button>
        ) : null}
        <Button icon="Plus" size="md" className="flex-1" isDisabled={create.isPending} onPress={newJob}>
          New work order
        </Button>
      </View>
    </Dock>
  );
}

function AssetLoading() {
  return (
    <LoadingView label="Loading the asset" className="px-4 pt-1">
      <LoadingBone className="rounded-3xl" style={{ height: metrics.photo.banner }} />
      <View className="flex-row gap-2">
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
      </View>
      <LoadingBone className="h-32 rounded-3xl" />
      <LoadingBone className="h-4 w-20" />
      <LoadingBone className="h-40 rounded-3xl" />
    </LoadingView>
  );
}
