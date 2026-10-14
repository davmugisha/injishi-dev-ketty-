import { DEMO_OTP, homeHref } from "@injishi/data";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Button, InputOTP, REGEXP_ONLY_DIGITS } from "heroui-native";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { useSession } from "@/lib/session";
import { startOtp, verifyOtp } from "@/lib/store";

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

/** One-time-code step cloned from the legacy demo (phone layout). The demo code is filled in. */
export default function VerifyScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ challenge: string; email: string }>();
  const [challenge, setChallenge] = useState(params.challenge);
  const [code, setCode] = useState(DEMO_OTP);
  const [error, setError] = useState<string | null>(null);
  const [resendKey, setResendKey] = useState(0);
  const expiry = useCountdown(600, resendKey);
  const resend = useCountdown(30, resendKey);
  const { refresh } = useSession();

  const verify = () => {
    const result = verifyOtp(challenge, code);
    if (!result.ok) {
      if (result.reason === "wrong-code")
        setError(
          `That code didn’t match. Use the newest message we sent. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.`,
        );
      else if (result.reason === "locked")
        setError("Too many wrong codes. Sign-in is paused for 15 minutes for this email.");
      else setError("This code has expired. Go back and ask for a new one.");
      return;
    }
    refresh();
    router.replace(homeHref(result.personaId) as never);
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 px-5 pb-12"
      contentContainerStyle={{ paddingTop: insets.top + 32 }}
    >
      <Image
        source={require("../../assets/logo-palm.svg")}
        style={{ width: 46, height: 40 }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
      <View className="gap-2">
        <Text className="text-[30px] leading-9 font-semibold text-foreground">Check your email</Text>
        <Text className="text-[15px] leading-[22px] text-muted">
          We sent a 6-digit code to <Text className="font-semibold text-foreground">{params.email}</Text>. It expires in{" "}
          <Text className="font-semibold text-foreground">
            {Math.floor(expiry / 60)}:{String(expiry % 60).padStart(2, "0")}
          </Text>
          .
        </Text>
      </View>

      <Alert status="default">
        <Alert.Indicator>
          <Icon name="CircleInfo" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Description>
            This is the Injishi demo, so every code is <Text className="font-semibold text-foreground">123456</Text>.
            We’ve filled it in for you.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <InputOTP
        maxLength={6}
        value={code}
        onChange={setCode}
        pattern={REGEXP_ONLY_DIGITS}
        isInvalid={!!error}
        textInputProps={{ accessibilityLabel: "One-time code" }}
      >
        <InputOTP.Group className="w-full justify-between gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTP.Slot key={i} index={i} className="h-14 flex-1" />
          ))}
        </InputOTP.Group>
      </InputOTP>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger">
          {error}
        </Text>
      ) : null}
      <Button className="rounded-full" isDisabled={code.length !== 6} onPress={verify}>
        <Button.Label>Verify and continue</Button.Label>
      </Button>

      <View className="flex-row items-center justify-between">
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          <Icon name="ArrowLeft" />
          <Button.Label>Different email</Button.Label>
        </Button>
        {resend > 0 ? (
          <Text className="text-[13px] text-muted">Resend in {resend}s</Text>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              const again = startOtp(params.email);
              if (again.ok) {
                setChallenge(again.challengeId);
                setResendKey((k) => k + 1);
              }
            }}
          >
            <Button.Label>Resend code</Button.Label>
          </Button>
        )}
      </View>
      <Text className="text-xs text-muted">Use the same email with Google later and it opens this same account.</Text>
    </ScrollView>
  );
}
