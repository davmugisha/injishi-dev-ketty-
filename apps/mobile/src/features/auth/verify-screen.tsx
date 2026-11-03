import { DEMO_OTP } from "@injishi/data";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Banner, Button, Dock, IconTile, NavBar, OtpInput, PressArea, Screen, Text, useToast } from "@/components/ui";
import { requestCode, verifyCode } from "@/lib/auth";
import { isMock } from "@/lib/data-mode";
import { useSession } from "@/lib/session";
import { href } from "@/proto/screens";
import { protoSignIn } from "@/proto/session";

const VERIFY_ERRORS = {
  "wrong-code": "That code didn’t match. Use the newest message we sent.",
  expired: "This code has expired. Ask for a new one below.",
  "too-many": "Too many wrong codes. Ask for a new code.",
  unavailable: "We couldn’t reach Injishi to check your code. Check your connection and try again.",
} as const;

const RESEND_ERRORS = {
  "invalid-email": "That doesn’t look like an email address. Go back and check it.",
  "too-many": "Too many codes for this email. Wait an hour, or use the newest code we sent.",
  unavailable: "We couldn’t reach Injishi to send a new code. Check your connection and try again.",
} as const;

const CODE_LENGTH = 6;
/** Seconds before a new code may be asked for. */
const RESEND_AFTER = 45;
/** The prototype's sample address, when sample data mode opens this screen with none. */
const SAMPLE_EMAIL = "sarah.kimani@gmail.com";

/** Seconds left, restarting whenever `resetKey` changes. */
function useCountdown(seconds: number, resetKey: number) {
  const [left, setLeft] = useState(seconds);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new resetKey restarts the countdown
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds, resetKey]);
  return left;
}

/** "0:42". */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Enter the emailed code (prototype `shared-verify`): six boxes, paste friendly, a visible resend
 * timer, and what the session means on this phone. Api mode checks the code with Better Auth and
 * hands over to the start route, which opens the step up, the page a guest came from, or the
 * person's own app; on the demo API the code is filled in. Sample data mode takes any six digits
 * and signs in as the sample guest, as the prototype's Continue does.
 */
export function VerifyScreen() {
  const params = useLocalSearchParams<{ email?: string; demo?: string }>();
  const email = params.email || (isMock ? SAMPLE_EMAIL : "");
  const demo = !isMock && params.demo === "1";
  const [code, setCode] = useState(demo ? DEMO_OTP : "");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [resendKey, setResendKey] = useState(0);
  const resendIn = useCountdown(RESEND_AFTER, resendKey);
  const { refresh } = useSession();
  const toast = useToast();

  const changeEmail = () => {
    if (router.canGoBack()) router.back();
    else router.replace(href("shared-signin"));
  };

  const verify = async () => {
    if (isMock) {
      protoSignIn("guest");
      router.replace(href("guest-home-stay"));
      return;
    }
    setChecking(true);
    const result = await verifyCode(email, code);
    if (!result.ok) {
      setChecking(false);
      setError(VERIFY_ERRORS[result.reason]);
      return;
    }
    await refresh();
    // The start route sends the person on: the step up when owed, the page they came from, their app.
    router.replace("/");
  };

  const sendAgain = async () => {
    if (!isMock) {
      const again = await requestCode(email);
      if (!again.ok) {
        setError(RESEND_ERRORS[again.reason]);
        return;
      }
    }
    setError(null);
    setCode("");
    setResendKey((k) => k + 1);
    toast.show({ icon: "Envelope", message: `A new code is on its way to ${email}` });
  };

  return (
    <Screen
      header={<NavBar title="" onBack={changeEmail} />}
      dock={
        <Dock>
          <Button size="lg" isDisabled={code.length !== CODE_LENGTH || checking} onPress={() => void verify()}>
            {checking ? "Checking…" : "Continue"}
          </Button>
          <View className="flex-row items-center justify-center">
            <Text role="caption" tone="muted">
              Wrong email?{" "}
            </Text>
            <PressArea
              onPress={changeEmail}
              accessibilityRole="link"
              accessibilityLabel="Wrong email? Change it"
              className="-my-3 justify-center"
            >
              <Text role="caption" strong tone="accent">
                Change it
              </Text>
            </PressArea>
          </View>
        </Dock>
      }
    >
      <View className="gap-5 px-4 pt-2">
        <View className="self-start">
          <IconTile icon="Envelope" size="lg" />
        </View>
        <View className="gap-2">
          <Text role="title2">Check your email</Text>
          <Text role="body" tone="muted">
            We sent a 6-digit code to{" "}
            <Text role="body" strong>
              {email}
            </Text>
            . It works for 10 minutes.
          </Text>
        </View>

        {demo ? (
          <Banner
            tone="info"
            body={`This is the Injishi demo, so every code is ${DEMO_OTP}. We’ve filled it in for you.`}
          />
        ) : null}

        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (error) setError(null);
          }}
          length={CODE_LENGTH}
          invalid={Boolean(error)}
          autoFocus={!demo}
          label="Code from the email, 6 digits"
        />
        {error ? (
          <Text role="callout" tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <View className="flex-row items-center justify-between gap-3">
          <Text role="callout" tone="muted" className="shrink">
            Didn’t get it? Check spam.
          </Text>
          {resendIn > 0 ? (
            <Text role="callout" tone="muted" tabular>
              {`Resend in ${clock(resendIn)}`}
            </Text>
          ) : (
            <PressArea
              onPress={() => void sendAgain()}
              accessibilityRole="button"
              accessibilityLabel="Send a new code"
              className="-my-3 justify-center"
            >
              <Text role="callout" strong tone="accent">
                Send a new code
              </Text>
            </PressArea>
          )}
        </View>

        <Banner
          icon="ShieldCheck"
          body="Your session stays on this phone for 60 days. Signing out on another device signs this one out too."
        />
      </View>
    </Screen>
  );
}
