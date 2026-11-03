import { View } from "react-native";
import {
  Button,
  Card,
  Icon,
  IconTile,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Section,
  Text,
  Tile,
  TileGrid,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useCreateRequest, useRequests } from "./data";
import type { QuickRequest, Requests } from "./types";
import { backOr, callPhone, CardBone, ListBones, openScreen, REQUEST_LOOK, RequestChip, TextLink } from "./ui";

/**
 * How can we help? Common requests are one tap; urgent safety issues get a call button first. Every
 * request shows who has it and when. Inside the Home tab, so the tab bar stays.
 */
export function RequestsScreen() {
  const requests = useRequests();
  const create = useCreateRequest();
  const toast = useToast();

  const ask = (quick: QuickRequest) => {
    if (quick.id === "food") {
      openScreen(href("guest-order"));
      return;
    }
    create.mutate(quick.id, {
      onSuccess: (team) =>
        toast.show({ icon: "CircleCheck", message: `${quick.label}: sent to ${team.toLowerCase()}`, haptic: "success" }),
      onError: () => toast.show({ icon: "CloudSlash", message: "Not sent. Try again in a moment.", haptic: "error" }),
    });
  };

  return (
    <Screen
      header={
        <NavBar
          title="How can we help?"
          subtitle="Requests go straight to the team that handles them"
          onBack={() => backOr(href("guest-home-stay"))}
        />
      }
    >
      <QueryView offlineNote={null} query={requests} data={requests.data} loading={<RequestsBones />}>
        {(data) => <RequestsBody data={data} onAsk={ask} />}
      </QueryView>
    </Screen>
  );
}

function RequestsBody({ data, onAsk }: { data: Requests; onAsk: (quick: QuickRequest) => void }) {
  return (
    <View className="pt-1">
      <TileGrid columns={3} className="px-4">
        {data.quick.map((quick) => (
          <Tile key={quick.id} icon={quick.icon} label={quick.label} caption={quick.caption} onPress={() => onAsk(quick)} />
        ))}
      </TileGrid>
      <View className="mt-4 px-4">
        <Card tone="danger" padding="sm">
          <View className="flex-row items-center gap-3">
            <IconTile icon="Thunderbolt" tone="danger" />
            <View className="flex-1 gap-0.5">
              <Text role="callout" strong>
                {data.urgent.title}
              </Text>
              <Text role="caption">{data.urgent.body}</Text>
            </View>
            <Button
              size="sm"
              variant="danger"
              icon="Handset"
              accessibilityLabel="Call the duty manager"
              onPress={() => callPhone(data.urgent.phone)}
            >
              Call
            </Button>
          </View>
        </Card>
      </View>
      <Section title="This stay" />
      {data.requests.length > 0 ? (
        <ListGroup className="mx-4">
          {data.requests.map((request) => (
            <ListItem
              key={request.id}
              icon={request.icon}
              tone={REQUEST_LOOK[request.status].tone}
              title={request.title}
              subtitle={request.detail}
              trailing={<RequestChip status={request.status} />}
            />
          ))}
        </ListGroup>
      ) : (
        <Card tone="flat" className="mx-4">
          <Text role="callout" tone="muted" className="text-center">
            Nothing asked yet this stay. Tap a tile above and the right team gets it.
          </Text>
        </Card>
      )}
      <View className="mt-3 flex-row flex-wrap items-center gap-1.5 px-4">
        <Icon name="Bell" size={16} tone="muted" />
        <Text role="caption" tone="muted">
          {data.notice}
        </Text>
        <TextLink
          label="Change"
          hint="Opens your account settings"
          onPress={() => openScreen(href("shared-account"))}
        />
      </View>
    </View>
  );
}

function RequestsBones() {
  return (
    <LoadingView label="Loading requests" className="px-4 pt-1">
      <View className="flex-row gap-2.5">
        <LoadingBone className="h-24 flex-1 rounded-3xl" />
        <LoadingBone className="h-24 flex-1 rounded-3xl" />
        <LoadingBone className="h-24 flex-1 rounded-3xl" />
      </View>
      <View className="flex-row gap-2.5">
        <LoadingBone className="h-24 flex-1 rounded-3xl" />
        <LoadingBone className="h-24 flex-1 rounded-3xl" />
        <LoadingBone className="h-24 flex-1 rounded-3xl" />
      </View>
      <CardBone className="h-20" />
      <LoadingBone className="mt-2 h-4 w-1/4" />
      <ListBones rows={3} />
    </LoadingView>
  );
}
