import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Dock,
  Field,
  IconTile,
  Input,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { NotWiredError } from "@/data/source";
import { isMock } from "@/lib/data-mode";
import { resetWelcome } from "@/lib/welcome";
import { href } from "@/proto/screens";
import { protoSignOut } from "@/proto/session";
import { useSurface } from "@/proto/surface";
import { useDeleteAccount, useDeleteInfo } from "./data";
import { ListBones, useBackTo } from "./ui";

const CODE_LENGTH = 6;

/**
 * Delete account (prototype `shared-delete`): says plainly what goes now and what the hotels must
 * keep by law, flags an upcoming trip, and confirms with the code emailed to the person. On sample
 * data any six digits delete the sample account: the session ends and the welcome shows again.
 */
export function DeleteAccountScreen() {
  const surface = useSurface();
  const query = useDeleteInfo(surface);
  const remove = useDeleteAccount();
  const toast = useToast();
  const back = useBackTo(href("shared-account", undefined, { app: surface }));
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    remove.mutate(code, {
      onSuccess: (deleted) => {
        if (!deleted) {
          setError("Enter the 6-digit code from the email.");
          return;
        }
        if (isMock) {
          protoSignOut();
          resetWelcome();
        }
        toast.show({ icon: "CircleCheck", message: "Your Injishi account is deleted" });
        router.replace("/");
      },
      onError: (failure) =>
        setError(
          failure instanceof NotWiredError
            ? "Deleting an account isn't connected yet. Nothing was deleted."
            : "We couldn't reach Injishi. Nothing was deleted; try again.",
        ),
    });
  };

  return (
    <Screen
      header={<NavBar title="Delete account" onBack={back} />}
      dock={
        <Dock>
          <Button
            variant="danger"
            size="lg"
            isDisabled={code.length !== CODE_LENGTH || remove.isPending}
            onPress={confirm}
          >
            {remove.isPending ? "Deleting…" : "Delete my account"}
          </Button>
          <Button variant="ghost" size="sm" onPress={back}>
            Keep my account
          </Button>
        </Dock>
      }
    >
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading what deleting means" className="px-4 pt-2">
            <LoadingBone className="h-12 w-12 rounded-2xl" />
            <LoadingBone className="h-7 w-4/5" />
            <ListBones rows={3} />
            <LoadingBone className="h-14 rounded-2xl" />
          </LoadingView>
        }
      >
        {(view) => (
          <View className="gap-4 px-4 pt-2">
            <View className="self-start">
              <IconTile icon="TrashBin" tone="danger" size="lg" />
            </View>
            <Text role="title2">Delete your Injishi account?</Text>
            <ListGroup>
              {view.items.map((item) => (
                <ListItem
                  key={item.title}
                  icon={item.icon}
                  tone={item.tone}
                  title={item.title}
                  subtitle={item.detail}
                />
              ))}
            </ListGroup>
            <Field
              label="Type the code we emailed you"
              hint={`Sent to ${view.email}. This makes sure it is really you.`}
              error={error ?? undefined}
            >
              <Input
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                placeholder="6-digit code"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
              />
            </Field>
          </View>
        )}
      </QueryView>
    </Screen>
  );
}
