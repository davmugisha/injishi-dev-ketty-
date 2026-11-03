import { rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ScopedTheme } from "uniwind";
import {
  Button,
  Chip,
  Dialog,
  Dock,
  Field,
  Input,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  QrCode,
  ScanFrame,
  Screen,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { haptic } from "@/lib/haptics";
import { href } from "@/proto/screens";
import { useClaimScan, useClaimStay } from "./data";
import type { ClaimScan } from "./types";
import { backOr } from "./ui";

/** The desk's QR as it shows on their phone, held a little askew in front of the camera. */
const QR_SIDE = metrics.qr - rnSpace[4];

/**
 * Scan the desk QR (G4): a walk-in guest scans the code the desk shows, and the stay, its bill and its
 * messages appear in the app. Typing the stay code is the fallback. Dark, as a camera is.
 */
export function ClaimScreen() {
  const scan = useClaimScan();
  const data = scan.data;
  const [entering, setEntering] = useState(false);
  return (
    <ScopedTheme theme="dark">
      <Screen
        scroll={false}
        header={<NavBar title="Scan the desk QR" onBack={() => backOr(href("guest-trips"))} />}
        dock={
          data ? (
            <Dock clear note={data.note}>
              <Button size="lg" variant="onPhoto" onPress={() => setEntering(true)}>
                Type the stay code instead
              </Button>
            </Dock>
          ) : undefined
        }
      >
        <QueryView offlineNote={null} query={scan} data={data} loading={<ClaimBones />}>
          {(d) => <Viewfinder scan={d} />}
        </QueryView>
        {data ? <CodeDialog isOpen={entering} onClose={() => setEntering(false)} example={data.codeExample} /> : null}
      </Screen>
    </ScopedTheme>
  );
}

function Viewfinder({ scan }: { scan: ClaimScan }) {
  return (
    <View className="flex-1 justify-center px-4 pb-2">
      <ScanFrame
        photo={scan.photo}
        label={scan.instruction}
        status={<Chip variant="glass" size="lg" icon="QrCode" label={scan.status} />}
      >
        <View style={{ transform: [{ rotate: TILT }] }}>
          <QrCode seed={scan.qrSeed} size={QR_SIDE} label="The desk's QR code for this stay" />
        </View>
      </ScanFrame>
    </View>
  );
}

/** `.gx-qrphone`'s `rotate: -3deg`: a phone held up by hand is never square to the camera. */
const TILT = "-3deg";

/** The fallback: the stay code the desk reads out or shows under the QR. */
function CodeDialog({ isOpen, onClose, example }: { isOpen: boolean; onClose: () => void; example: string }) {
  const claim = useClaimStay();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const submit = () => {
    setError(undefined);
    claim.mutate(code, {
      onSuccess: (linked) => {
        if (!linked) {
          setError(`That isn't a stay code. It looks like ${example}.`);
          haptic.error();
          return;
        }
        haptic.success();
        onClose();
        // The confirmation takes the scanner's place: back from it is the trips the guest came from.
        router.replace(href("guest-claimed"));
      },
      onError: () => setError("Couldn't link the stay. Check your signal and try again."),
    });
  };
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      icon="QrCode"
      title="Type the stay code"
      body={`The desk shows it under the QR code, like ${example}.`}
      actions={
        <>
          <Button onPress={submit} isDisabled={claim.isPending || code.trim().length === 0}>
            Add the stay
          </Button>
          <Button variant="ghost" onPress={onClose}>
            Scan instead
          </Button>
        </>
      }
    >
      <Field label="Stay code" error={error}>
        <Input
          value={code}
          onChangeText={(next) => {
            setCode(next.toUpperCase());
            setError(undefined);
          }}
          placeholder={example}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={submit}
          returnKeyType="done"
        />
      </Field>
    </Dialog>
  );
}

function ClaimBones() {
  return (
    <LoadingView label="Opening the camera" className="flex-1 justify-center px-4">
      <LoadingBone className="h-96 w-full rounded-3xl" />
    </LoadingView>
  );
}
