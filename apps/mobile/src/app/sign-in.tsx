import { PERSONA_IDS, type Persona, personaByEmail, personas } from "@injishi/data";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, FieldError, Input, Separator, TextField } from "heroui-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { signInDirect, startOtp } from "@/lib/store";

/** Phone apps on this device: housekeeping, supervisor, technician, guest and resident. */
const PHONE_PERSONAS: Persona[] = PERSONA_IDS.map((id) => personas[id]).filter((p) => p.app.kind === "phone");

function PersonaCard({
  persona,
  onSignIn,
  onUseEmail,
}: {
  persona: Persona;
  onSignIn: () => void;
  onUseEmail: () => void;
}) {
  const [more, setMore] = useState(false);
  return (
    <Card variant="transparent" className="gap-2 rounded-2xl border border-border p-3.5">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="font-semibold text-foreground">{persona.name}</Text>
        <Text className="shrink text-xs text-muted" numberOfLines={1}>
          {persona.email}
        </Text>
      </View>
      <Text className="text-[15px] font-medium text-foreground">{persona.headline}</Text>
      <Text className="text-[13px] leading-[18px] text-muted" numberOfLines={more ? undefined : 2}>
        {persona.lands}
      </Text>
      {more ? (
        <View className="gap-1">
          <Text className="text-xs font-semibold tracking-wider text-muted uppercase">What to try</Text>
          {persona.tryItems.map((t, i) => (
            <Text key={t.board} className="text-[13px] leading-[18px] text-foreground">
              {i + 1}. <Text className="font-medium">{t.label}</Text> <Text className="text-muted">— {t.note}</Text>
            </Text>
          ))}
        </View>
      ) : null}
      <Button variant="ghost" size="sm" className="self-start px-0" onPress={() => setMore(!more)}>
        <Button.Label className="underline">{more ? "Less about this role" : "More about this role"}</Button.Label>
      </Button>
      <View className="flex-row flex-wrap items-center gap-2">
        <Chip size="sm" variant="secondary" color="default">
          <Chip.Label>{persona.role}</Chip.Label>
        </Chip>
        <Text className="text-xs text-muted">{persona.org}</Text>
      </View>
      <View className="flex-row items-center gap-3 pt-1">
        <Button className="flex-1 rounded-full" onPress={onSignIn}>
          <Button.Label>{`Sign in as ${persona.firstName}`}</Button.Label>
        </Button>
        <Button variant="ghost" size="sm" onPress={onUseEmail}>
          <Button.Label className="underline">Use this email</Button.Label>
        </Button>
      </View>
    </Card>
  );
}

/** Sign-in cloned from the legacy Injishi demo (phone layout), listing the artifact's phone personas. */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { as } = useLocalSearchParams<{ as?: string }>();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Preview builds can deep-link a persona (A/B captures): /sign-in?as=housekeeper
  useEffect(() => {
    if (as && as in personas && Platform.OS === "web") {
      signInDirect(as as Persona["id"]);
      refresh();
      router.replace("/");
    }
  }, [as, refresh]);

  const begin = (address: string) => {
    // The phone apps are for the phone personas; workspace people sign in on the web app.
    const person = personaByEmail(address.trim());
    if (person && person.app.kind !== "phone") {
      setError(
        `${person.firstName} works in the Injishi web workspace, not the phone app. Sign in on the web, or choose someone from Explore the demo.`,
      );
      return;
    }
    const started = startOtp(address.trim());
    if (!started.ok) {
      setError("There’s no demo account with that email. Choose someone from Explore the demo, or check the spelling.");
      return;
    }
    setError(null);
    router.push({ pathname: "/verify", params: { challenge: started.challengeId, email: started.email } });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="items-center gap-5 px-5 pb-12"
        contentContainerStyle={{ paddingTop: insets.top + 40 }}
      >
        <Image
          source={require("../../assets/logo-palm.svg")}
          style={{ width: 50, height: 44 }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
        <Text className="text-center text-[30px] leading-9 font-medium text-foreground">Welcome to Injishi</Text>

        <View className="w-full items-center gap-2">
          <Text className="text-[13px] text-muted">Continue with</Text>
          <Button variant="secondary" isDisabled className="w-full rounded-full">
            <Button.Label>G Continue with Google</Button.Label>
          </Button>
          <Text className="text-xs text-muted">Sign in with Google isn’t available in the demo yet.</Text>
        </View>

        <View className="w-full flex-row items-center gap-3">
          <Separator className="flex-1" />
          <Text className="text-xs text-muted">Or continue with email</Text>
          <Separator className="flex-1" />
        </View>

        <View className="w-full gap-3">
          <TextField isInvalid={!!error}>
            <Input
              placeholder="Enter your email"
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </TextField>
          <Button variant="secondary" className="rounded-full" onPress={() => begin(email)}>
            <Button.Label>Continue</Button.Label>
          </Button>
        </View>

        <Card className="w-full gap-3 p-4">
          <Text className="text-[15px] font-semibold text-foreground">Explore the demo</Text>
          <Text className="text-[13px] leading-[18px] text-muted">
            Choose someone and sign in as them in one step. Typing an email by hand works too: every code is{" "}
            <Text className="font-semibold text-foreground">123456</Text>.
          </Text>
          <Text className="text-xs text-muted">Demo data last reset 12 Oct, 10:00</Text>
          <Text className="pt-1 text-xs font-semibold tracking-wider text-muted uppercase">
            Staff devices, guests and residents
          </Text>
          {PHONE_PERSONAS.map((p) => (
            <PersonaCard key={p.id} persona={p} onSignIn={() => begin(p.email)} onUseEmail={() => setEmail(p.email)} />
          ))}
          <Text className="text-xs leading-4 text-muted">
            Owners, managers and back-office roles use the web workspace.
          </Text>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
