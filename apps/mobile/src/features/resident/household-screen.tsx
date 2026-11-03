import { useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Choice,
  Dialog,
  Dock,
  Field,
  Input,
  KeyValue,
  ListGroup,
  ListItem,
  NavBar,
  Screen,
  Text,
  Toggle,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useAddHouseholdMember, useHousehold, useSetStandingPass } from "./data";
import type { HouseholdView, NewMember } from "./types";
import { backOr, CardBone, ListBone, Skeleton, useNotify } from "./ui";

/**
 * `res-household`: who lives here and who may enter. House help gets a standing pass without
 * payment or code rights; the pass can be paused. "Add someone" invites a person to the lease or
 * gives house help a pass.
 */
export function HouseholdScreen() {
  const query = useHousehold();
  const [adding, setAdding] = useState(false);
  return (
    <Screen
      header={<NavBar title="Household" subtitle={query.data?.unit} onBack={() => backOr(href("res-building"))} />}
      dock={
        query.data ? (
          <Dock>
            <Button size="lg" icon="PersonPlus" onPress={() => setAdding(true)}>
              Add someone
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView
        query={query}
        data={query.data}
        loading={
          <Skeleton label="Loading your household">
            <ListBone rows={3} />
            <CardBone size="lg" />
          </Skeleton>
        }
      >
        {(view) => <Household view={view} />}
      </QueryView>
      <AddDialog isOpen={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function Household({ view }: { view: HouseholdView }) {
  const pass = useSetStandingPass();
  const notify = useNotify();
  const setPass = (on: boolean) =>
    pass.mutate(on, {
      onSuccess: () =>
        notify.done(on ? `${view.pass?.name}'s pass works again` : `${view.pass?.name}'s pass is paused`, "Key"),
      onError: notify.failed,
    });
  return (
    <View className="gap-4 px-4">
      <ListGroup>
        {view.members.map((m) => (
          <ListItem
            key={m.id}
            leading={<Avatar initials={m.initials} tone={m.tone} />}
            title={m.name}
            subtitle={m.subtitle}
            trailing={<Chip label={m.role.label} tone={m.role.tone} />}
          />
        ))}
      </ListGroup>

      {view.pass ? (
        <Card tone="flat">
          <View className="flex-row items-center justify-between gap-3">
            <Text role="headline" className="flex-1">{`${view.pass.name}'s standing pass`}</Text>
            <Toggle
              value={view.pass.on}
              onValueChange={setPass}
              isDisabled={pass.isPending}
              label={`${view.pass.name}'s standing pass`}
            />
          </View>
          <KeyValue className="mt-1" rows={view.pass.rows} />
          <Text role="caption" tone="muted" className="mt-2">
            {view.pass.note}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}

const KINDS = [
  { value: "lease", title: "On the lease", subtitle: "Lives here; can request repairs and make visitor codes" },
  { value: "help", title: "House help", subtitle: "A standing pass on weekdays; no codes, no payments" },
] as const satisfies readonly { value: NewMember["kind"]; title: string; subtitle: string }[];

/** Add someone: their name and what they may do. */
function AddDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<NewMember["kind"]>("help");
  const add = useAddHouseholdMember();
  const notify = useNotify();
  const close = () => {
    setName("");
    setKind("help");
    onClose();
  };
  const save = () =>
    add.mutate(
      { name, kind },
      {
        onSuccess: () => {
          notify.done(
            kind === "lease"
              ? `${name.trim()} is invited. Solange checks the ID.`
              : `${name.trim()} gets a pass from tomorrow`,
            "PersonPlus",
          );
          close();
        },
        onError: notify.failed,
      },
    );
  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      icon="PersonPlus"
      title="Add someone"
      actions={
        <>
          <Button isDisabled={name.trim().length < 2 || add.isPending} onPress={save}>
            {kind === "lease" ? "Invite to the lease" : "Give a standing pass"}
          </Button>
          <Button variant="ghost" onPress={close}>
            Not now
          </Button>
        </>
      }
    >
      <View className="gap-3">
        <Field label="Their name, as on their ID">
          <Input value={name} onChangeText={setName} autoCapitalize="words" placeholder="Aline Uwase" />
        </Field>
        {KINDS.map((k) => (
          <Choice
            key={k.value}
            title={k.title}
            subtitle={k.subtitle}
            selected={kind === k.value}
            onPress={() => setKind(k.value)}
          />
        ))}
      </View>
    </Dialog>
  );
}
