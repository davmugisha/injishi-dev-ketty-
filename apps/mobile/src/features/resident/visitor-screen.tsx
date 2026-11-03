import { useState } from "react";
import { Share, View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Choice,
  Dialog,
  Dock,
  ListGroup,
  ListItem,
  LoadingBone,
  NavBar,
  QrCode,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useCancelVisitorCode, useChangeVisitWindow, useMarkCodeSent, useVisitorCode } from "./data";
import type { VisitorCode } from "./types";
import { backOr, CardBone, Eyebrow, ListBone, Skeleton, useNotify } from "./ui";

/** `qr("VP-1031-6093", 132)`: the visitor code's QR, smaller than the kit's default. */
const QR_SIDE = 132;

/**
 * `res-visitor`: a big 4-digit code and a QR for the gate guard, a time window that expires on its
 * own, and one press to send it. `?id=` opens an existing code (Jean's, from Building); without it,
 * the code being made for Grace. The time can change; a code can be cancelled.
 */
export function VisitorScreen() {
  const { id } = useScreenParams("res-visitor");
  const query = useVisitorCode(id);
  const sent = useMarkCodeSent();
  const notify = useNotify();
  const code = query.data;

  const share = async (visitor: VisitorCode) => {
    try {
      const result = await Share.share({
        message: `Hello ${visitor.firstName}, your gate code for Kacyiru Court is ${visitor.code} (${visitor.when}). ${visitor.rule}. The guard checks your name.`,
      });
      if (result.action !== Share.dismissedAction) sent.mutate(visitor.id, { onError: notify.failed });
    } catch {
      // No share sheet (the web preview): the code is still on screen to read out.
      sent.mutate(visitor.id, {
        onSuccess: () => notify.done(`Code ${visitor.code} ready for ${visitor.firstName}`, "ArrowShapeTurnUpRight"),
        onError: notify.failed,
      });
    }
  };

  return (
    <Screen
      header={<NavBar title="Visitor code" onBack={() => backOr(href("res-building"))} />}
      dock={
        code && code.status === "active" ? (
          <Dock note={`Shares the code by WhatsApp or SMS. The guard checks ${code.possessive} name too.`}>
            <Button size="lg" icon="ArrowShapeTurnUpRight" onPress={() => void share(code)}>
              {`Send to ${code.firstName}`}
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={code} loading={<VisitorSkeleton />}>
        {(data) => <Code code={data} />}
      </QueryView>
    </Screen>
  );
}

function Code({ code }: { code: VisitorCode }) {
  const [dialog, setDialog] = useState<"time" | "cancel" | null>(null);
  const [slot, setSlot] = useState(code.window);
  const change = useChangeVisitWindow();
  const cancel = useCancelVisitorCode();
  const notify = useNotify();
  const active = code.status === "active";

  const saveTime = () =>
    change.mutate(
      { id: code.id, window: slot },
      {
        onSuccess: () => {
          setDialog(null);
          notify.done("New time saved. Send the code again if you shared it.", "Calendar");
        },
        onError: notify.failed,
      },
    );
  const cancelCode = () =>
    cancel.mutate(code.id, {
      onSuccess: () => {
        setDialog(null);
        notify.done(`Code ${code.code} no longer opens the gate`, "Xmark");
      },
      onError: notify.failed,
    });

  return (
    <View className="gap-4 px-4">
      <Card raised padding="lg">
        <View className={`items-center gap-3 ${active ? "" : "opacity-50"}`}>
          <Eyebrow>For the gate guard</Eyebrow>
          <View
            accessible
            accessibilityLabel={`Code ${code.code.split("").join(" ")}`}
            className="flex-row justify-center gap-2"
          >
            {code.code.split("").map((digit, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a digit's place in the code is its identity
              <View key={index} className="h-16 w-14 items-center justify-center rounded-2xl bg-surface-secondary">
                <Text role="display" tabular maxScale={1.2}>
                  {digit}
                </Text>
              </View>
            ))}
          </View>
          <QrCode seed={code.seed} size={QR_SIDE} label={`QR code for ${code.name}'s visit`} />
          <View className="items-center gap-1">
            <Text role="title3" className="text-center">
              {code.name}
            </Text>
            <Text role="callout" tone="muted" className="text-center">
              {code.when}
            </Text>
          </View>
          {active ? (
            <Chip label={code.rule} tone="accent" icon="Clock" />
          ) : (
            <Chip label="Cancelled" tone="danger" icon="Xmark" />
          )}
        </View>
      </Card>

      {code.sent && active ? <Banner tone="success" icon="CircleCheck" body={code.sent} /> : null}
      {active ? null : (
        <Banner
          tone="danger"
          icon="Xmark"
          title="This code no longer opens the gate"
          body="The guard is told. Make a new code from Building if the visit still happens."
        />
      )}

      {active ? (
        <ListGroup>
          <ListItem
            icon="Calendar"
            tone="default"
            title="Change time"
            subtitle="Or make it overnight (up to 7 nights)"
            onPress={() => {
              setSlot(code.window);
              setDialog("time");
            }}
          />
          <ListItem
            icon="Xmark"
            tone="danger"
            title="Cancel this code"
            titleTone="danger"
            chevron={false}
            onPress={() => setDialog("cancel")}
          />
        </ListGroup>
      ) : null}

      <Dialog
        isOpen={dialog === "time"}
        onClose={() => setDialog(null)}
        icon="Calendar"
        title="When can they come in?"
        body="The code works inside this window only, then stops by itself."
        actions={
          <>
            <Button isDisabled={change.isPending} onPress={saveTime}>
              Save the new time
            </Button>
            <Button variant="ghost" onPress={() => setDialog(null)}>
              Keep it as it is
            </Button>
          </>
        }
      >
        <View className="gap-2">
          {code.windows.map((w) => (
            <Choice
              key={w.value}
              title={w.label}
              subtitle={w.detail}
              selected={slot === w.value}
              onPress={() => setSlot(w.value)}
            />
          ))}
        </View>
      </Dialog>

      <Dialog
        isOpen={dialog === "cancel"}
        onClose={() => setDialog(null)}
        icon="Xmark"
        tone="danger"
        title={`Cancel ${code.firstName}'s code?`}
        body={`${code.code} stops opening the gate at once. If you sent it, tell ${code.firstName}.`}
        actions={
          <>
            <Button variant="danger" isDisabled={cancel.isPending} onPress={cancelCode}>
              Cancel the code
            </Button>
            <Button variant="ghost" onPress={() => setDialog(null)}>
              Keep it
            </Button>
          </>
        }
      />
    </View>
  );
}

function VisitorSkeleton() {
  return (
    <Skeleton label="Loading the visitor code">
      <LoadingBone className="h-96 rounded-3xl" />
      <ListBone rows={2} />
      <CardBone size="sm" />
    </Skeleton>
  );
}
