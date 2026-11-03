import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Dialog,
  Dock,
  Icon,
  KeyValue,
  LoadingBone,
  NavBar,
  OtpInput,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useRenewal, useSignRenewal } from "./data";
import type { RenewalView } from "./types";
import { backOr, CardBone, DockLinks, Skeleton, TextLink, TitleBone, useNotify } from "./ui";

/**
 * `res-renewal`: old and new rent side by side with the percentage, the deposit top-up and the
 * signing method stated before the button. Signing takes the one-time code texted to the phone;
 * "I won't renew" opens moving out, "Ask Solange a question" the conversation with her.
 */
export function RenewalScreen() {
  const query = useRenewal();
  const view = query.data;
  const [signing, setSigning] = useState(false);
  const [reading, setReading] = useState(false);
  const offered = view?.state === "offered";

  return (
    <Screen
      header={<NavBar title="Renewal offer" subtitle={view?.deadline} onBack={() => backOr(href("res-lease"))} />}
      dock={
        view ? (
          <Dock>
            {offered ? (
              <Button size="lg" icon="Pencil" onPress={() => setSigning(true)}>
                Accept and sign
              </Button>
            ) : (
              <Button size="lg" variant="secondary" onPress={() => backOr(href("res-lease"))}>
                Back to my lease
              </Button>
            )}
            <DockLinks
              links={[
                ...(offered ? [{ label: "I won't renew", onPress: () => router.push(href("res-moveout")) }] : []),
                { label: `Ask ${view.manager} a question`, onPress: () => router.push(href("res-repair")) },
              ]}
            />
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={view} loading={<RenewalSkeleton />}>
        {(data) => <Offer view={data} onRead={() => setReading(true)} />}
      </QueryView>
      {view ? (
        <>
          <SignDialog isOpen={signing} onClose={() => setSigning(false)} phone={view.phone} />
          <Dialog
            isOpen={reading}
            onClose={() => setReading(false)}
            icon="FileText"
            title={view.amendment.title}
            body={view.amendment.body}
            actions={<Button onPress={() => setReading(false)}>Close</Button>}
          />
        </>
      ) : null}
    </Screen>
  );
}

function Offer({ view, onRead }: { view: RenewalView; onRead: () => void }) {
  return (
    <View className="gap-4 px-4">
      <View className="gap-1">
        <Text role="title2">{view.title}</Text>
        <Text role="callout" tone="muted">
          {view.intro}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        <RentBox label="Now" amount={view.now} note="a month" />
        <Icon name="ArrowRight" tone="muted" />
        <RentBox label={view.from} amount={view.next} note={`a month · ${view.change}`} isNew />
      </View>

      <Card padding="sm">
        <KeyValue
          rows={[
            ...view.rows,
            { label: "Amendment", value: <TextLink label="Read it (2 pages)" onPress={onRead} className="-my-3" /> },
          ]}
        />
      </Card>

      {view.state === "signed" && view.signedLine ? (
        <Banner tone="success" icon="SealCheck" title="Renewal signed" body={view.signedLine} />
      ) : (
        <Banner
          tone="info"
          icon="ShieldCheck"
          title="Signing takes a one-time code"
          body={`We text it to ${view.phone}. A typed name and tick works too, if you prefer.`}
        />
      )}
    </View>
  );
}

/** `.rx-cmp > div`: one month's rent, the new one on the accent tint. */
function RentBox({
  label,
  amount,
  note,
  isNew = false,
}: {
  label: string;
  amount: number;
  note: string;
  isNew?: boolean;
}) {
  return (
    <Card tone={isNew ? "accentSoft" : "flat"} padding="sm" className="flex-1">
      <Text role="caption" tone="muted" strong>
        {label}
      </Text>
      <Text role="title3" strong tabular>
        {amount.toLocaleString("en-US")}
      </Text>
      <Text role="caption" tone="muted" strong>
        {note}
      </Text>
    </Card>
  );
}

/** The one-time code texted to the phone, typed into six boxes, signs the renewal. */
function SignDialog({ isOpen, onClose, phone }: { isOpen: boolean; onClose: () => void; phone: string }) {
  const [code, setCode] = useState("");
  const sign = useSignRenewal();
  const notify = useNotify();
  const close = () => {
    setCode("");
    sign.reset();
    onClose();
  };
  const submit = (value = code) =>
    sign.mutate(value, {
      onSuccess: () => {
        notify.done("Renewal signed. Solange and the landlord countersign next.", "SealCheck");
        close();
      },
    });
  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      icon="ShieldCheck"
      title="Type the code we texted you"
      body={`Sent to ${phone} just now. It works for 10 minutes.`}
      actions={
        <>
          <Button icon="Pencil" isDisabled={code.length !== 6 || sign.isPending} onPress={() => submit()}>
            Sign the renewal
          </Button>
          <Button variant="ghost" onPress={close}>
            Not yet
          </Button>
        </>
      }
    >
      <View className="items-center gap-2">
        <OtpInput value={code} onChange={setCode} onComplete={submit} invalid={sign.isError} />
        {sign.isError ? (
          <Text role="caption" tone="danger" className="text-center">
            {sign.error?.message.startsWith("Not connected")
              ? "Not connected yet. Nothing was signed."
              : "That code did not work. Check the text and type it again."}
          </Text>
        ) : null}
      </View>
    </Dialog>
  );
}

function RenewalSkeleton() {
  return (
    <Skeleton label="Loading the renewal offer">
      <TitleBone line />
      <View className="flex-row gap-2">
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
      </View>
      <CardBone size="lg" />
      <CardBone size="sm" />
    </Skeleton>
  );
}
