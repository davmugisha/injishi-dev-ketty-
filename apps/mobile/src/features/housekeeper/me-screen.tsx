import { router } from "expo-router";
import { Fragment, useState } from "react";
import { View } from "react-native";
import {
  Chip,
  Icon,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useSignOut } from "@/features/auth/use-sign-out";
import { isMock } from "@/lib/data-mode";
import { href } from "@/proto/screens";
import { protoSignOut } from "@/proto/session";
import { useSurface } from "@/proto/surface";
import { useMe } from "./data";
import type { MeRow, MeView } from "./types";
import { Bones, ListBones, PersonAvatar, useStaffApp } from "./ui";

/**
 * `hk-me` (also the supervisor's and the technician's Me tab): payslips behind a PIN, hours and claims
 * (S3), documents, assets on loan, help, what waits on this phone, the place switch and sign out.
 */
export function MeScreen() {
  const app = useStaffApp();
  const surface = useSurface();
  const { query, data } = useMe(app);
  const signOut = useSignOut();
  const [open, setOpen] = useState<string | null>(null);

  const press = (row: MeRow): (() => void) | undefined => {
    switch (row.key) {
      case "payslips":
        return () => router.push(href("hk-pin", undefined, { app: surface }));
      case "hours":
        return () => router.push(href("hk-hours", undefined, { app: surface }));
      case "leave":
        // The supervisor app has no schedule tab: her leave is a number here, asked through HR.
        return app === "supervisor" ? undefined : () => router.navigate(href("hk-schedule", undefined, { app: surface }));
      case "documents":
      case "assets":
        return () => setOpen((now) => (now === row.key ? null : row.key));
      case "help":
        return () => router.push(href("shared-notifs", undefined, { app: surface }));
      case "outbox":
        return () => router.push(href("shared-outbox", undefined, { app: surface }), { withAnchor: true });
      case "switch":
        return () => router.push(href("shared-switcher"));
      case "signout":
        return () => {
          if (!isMock) {
            signOut();
            return;
          }
          // The sample session ends on the sign in screen, as the prototype's Sign out does.
          protoSignOut();
          router.replace(href("shared-signin"));
        };
      default:
        return undefined;
    }
  };

  return (
    <Screen>
      <QueryView query={query} data={data} loading={<MeLoading />}>
        {(me) => <MeBody me={me} open={open} press={press} />}
      </QueryView>
    </Screen>
  );
}

function MeBody({
  me,
  open,
  press,
}: {
  me: MeView;
  open: string | null;
  press: (row: MeRow) => (() => void) | undefined;
}) {
  return (
    <View className="mt-3 gap-4 px-4">
      <View className="flex-row items-center gap-3.5">
        <PersonAvatar person={me.person} size="xl" />
        <View className="flex-1">
          <Text role="title2">{me.person.fullName}</Text>
          {me.person.role ? (
            <Text role="callout" tone="muted">
              {me.person.role}
            </Text>
          ) : null}
          {me.person.employer ? (
            <Text role="caption" tone="muted">
              {me.person.employer}
            </Text>
          ) : null}
        </View>
      </View>
      {[me.work, me.files, me.phone]
        .filter((rows) => rows.length > 0)
        .map((rows) => (
          <ListGroup key={rows[0]?.key ?? "rows"}>
            {rows.map((row) => (
              <Fragment key={row.key}>
                <Row row={row} open={open === row.key} onPress={press(row)} />
                {open === row.key && row.details
                  ? row.details.map((line) => <ListItem key={line} title={line} chevron={false} />)
                  : null}
              </Fragment>
            ))}
          </ListGroup>
        ))}
    </View>
  );
}

function Row({ row, open, onPress }: { row: MeRow; open: boolean; onPress: (() => void) | undefined }) {
  const expands = Boolean(row.details);
  const trailing = row.locked ? (
    <Icon name="Lock" size={16} tone="muted" label="Locked" />
  ) : row.count ? (
    <Chip tone="warning" variant="solid" label={String(row.count)} />
  ) : expands ? (
    <Icon name={open ? "ChevronUp" : "ChevronDown"} size={16} tone="muted" />
  ) : null;
  return (
    <ListItem
      icon={row.icon}
      tone={row.tone}
      title={row.title}
      subtitle={row.subtitle || undefined}
      trailing={trailing}
      chevron={!expands && Boolean(onPress)}
      onPress={onPress}
      accessibilityLabel={expands ? `${row.title}, ${open ? "open" : "closed"}` : undefined}
    />
  );
}

function MeLoading() {
  return (
    <LoadingView label="Loading">
      <View className="flex-row items-center gap-3.5 px-4 pt-3">
        <LoadingBone className="size-20 rounded-full" />
        <View className="flex-1 gap-2">
          <LoadingBone className="h-6 w-48" />
          <LoadingBone className="h-4 w-56" />
        </View>
      </View>
      <Bones>
        <ListBones rows={3} />
        <ListBones rows={3} />
        <ListBones rows={4} />
      </Bones>
    </LoadingView>
  );
}
