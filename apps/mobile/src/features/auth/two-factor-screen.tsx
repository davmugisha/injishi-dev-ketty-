import { Redirect, router } from "expo-router";
import { InputOTP, REGEXP_ONLY_DIGITS } from "heroui-native";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyView, LoadingBone, LoadingView, PressArea, RowIcon, Text } from "@/components/ui";
import { useSession } from "@/lib/session";
import { type StepUpStart, sendStepUpCode, startStepUp, verifyStepUpCode } from "@/lib/step-up";
import { useSignOut } from "./use-sign-out";

const RESEND_AFTER_SECONDS = 30;

/** Seconds left before a resend, restarting whenever `key` changes. */
function useCountdown(key: number): number {
  const [left, setLeft] = useState(RESEND_AFTER_SECONDS);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new key restarts the countdown
  useEffect(() => {
    setLeft(RESEND_AFTER_SECONDS);
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1_000);
    return () => clearInterval(timer);
  }, [key]);
  return left;
}

/**
 * The step up (mobile spec 0003, AC-1, D-b, D-at; prototype `shared-02-verify`): after sign in, and on
 * any `two_factor_required`, the person enters a second emailed code once per session. With no signal
 * and no code kept on this phone, it asks to connect.
 */
export function TwoFactorScreen() {
  const insets = useSafeAreaInsets();
  const { status, account, stepUpOwed, stepUpVerified, refresh } = useSession();
  const signOut = useSignOut();
  const [start, setStart] = useState<StepUpStart | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [sends, setSends] = useState(0);
  const resendIn = useCountdown(sends);

  const begin = useCallback(async () => {
    setStart(null);
    const started = await startStepUp();
    if (started.status === "not-needed") stepUpVerified();
    if (started.status === "signed-out") void refresh();
    setStart(started);
  }, [stepUpVerified, refresh]);

  useEffect(() => {
    if (account && stepUpOwed) void begin();
  }, [account, stepUpOwed, begin]);

  if (status === "loading") return null;
  if (!account) return <Redirect href="/sign-in" />;
  if (!stepUpOwed) return <Redirect href="/" />;

  const check = async () => {
    setChecking(true);
    setError(null);
    const result = await verifyStepUpCode(code);
    setChecking(false);
    if (result.status === "verified") {
      stepUpVerified();
      router.replace("/");
    } else if (result.status === "signed-out") void refresh();
    else if (result.status === "offline") setError("We couldn't reach Injishi to check the code. Check your signal and try again.");
    else setError(result.message);
  };

  const resend = async () => {
    if (start?.status !== "sent") return;
    const again = await sendStepUpCode(start.sentTo);
    if (again.status === "sent") {
      setError(null);
      setSends((n) => n + 1);
    } else if (again.status === "offline") setError("We couldn't reach Injishi to send a new code.");
    else if (again.status === "refused") setError(again.message);
  };

  if (!start) {
    return (
      <View className="flex-1 bg-background px-5" style={{ paddingTop: insets.top + 32 }}>
        <LoadingView label="Sending your code">
          <LoadingBone className="h-12 w-12 rounded-2xl" />
          <LoadingBone className="h-8 w-3/5" />
          <LoadingBone className="h-14" />
        </LoadingView>
      </View>
    );
  }

  if (start.status === "offline" || start.status === "refused") {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <EmptyView
          icon={start.status === "offline" ? "CloudSlash" : "ShieldExclamation"}
          title={start.status === "offline" ? "Connect to get your code" : "We couldn't send your code"}
          body={
            start.status === "offline"
              ? "Your work needs one more emailed code on this phone. Connect to the internet, then we'll send it."
              : start.message
          }
          action={{ label: "Try again", icon: "ArrowRotateRight", onPress: () => void begin() }}
          secondary={{ label: "Sign out", onPress: signOut }}
        />
      </View>
    );
  }

  const sentTo = start.status === "sent" ? start.sentTo : "";
  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <RowIcon name="Envelope" tone="accent" />
        <View className="gap-2">
          <Text role="title1">Check your email</Text>
          <Text role="body" tone="muted">
            {`Your work needs one more code on this phone. We emailed it to ${sentTo}. It works for 10 minutes.`}
          </Text>
        </View>
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          pattern={REGEXP_ONLY_DIGITS}
          isInvalid={!!error}
          textInputProps={{ accessibilityLabel: "Code from the email" }}
        >
          <InputOTP.Group className="w-full justify-between gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTP.Slot key={i} index={i} className="h-14 flex-1" />
            ))}
          </InputOTP.Group>
        </InputOTP>
        {error ? (
          <Text role="callout" tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <View className="flex-row items-center justify-between">
          <Text role="caption" tone="muted">
            Didn't get it? Check spam.
          </Text>
          {resendIn > 0 ? (
            <Text role="caption" tone="muted">
              {`Resend in 0:${String(resendIn).padStart(2, "0")}`}
            </Text>
          ) : (
            <PressArea onPress={() => void resend()} accessibilityRole="button" className="justify-center px-2">
              <Text role="caption" tone="accent">
                Send a new code
              </Text>
            </PressArea>
          )}
        </View>
      </ScrollView>
      <View className="gap-2 border-t border-separator bg-surface px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <Button isDisabled={code.length !== 6 || checking} onPress={() => void check()}>
          {checking ? "Checking…" : "Continue"}
        </Button>
        <PressArea onPress={signOut} accessibilityRole="button" className="items-center justify-center">
          <Text role="caption" tone="muted">
            Not you? Sign out
          </Text>
        </PressArea>
      </View>
    </View>
  );
}
