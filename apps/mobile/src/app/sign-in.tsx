import { PERSONA_IDS, type Persona, personaByEmail, personas } from "@injishi/data";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, Chip, FieldError, Input, Separator, TextField } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Text as UiText } from "@/components/ui";
import { unsentCount } from "@/data/outbox/store";
import { lastAccount, requestCode, type SignInOptions, signInAs, signInOptions, signInWithGoogle } from "@/lib/auth";
import { useSession } from "@/lib/session";

const SEND_ERRORS = {
  "invalid-email": "That doesn’t look like an email address.",
  "too-many": "Too many codes for this email. Wait an hour, or use the newest code we sent.",
  unavailable: "We couldn’t reach Injishi to send your code. Check your connection and try again.",
} as const;

/** "15 Oct, 03:00", in Kigali. */
function resetLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Phone apps on this device: housekeeping, supervisor, technician and guest. */
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

/**
 * Sign-in (phone layout): an emailed code or Google, through the API. On the demo stack it also lists the
 * phone personas, one press away; anywhere else the list is not drawn, because a press would mail a code
 * to an address nobody owns.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { as } = useLocalSearchParams<{ as?: string }>();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState<SignInOptions | null>(null);
  const [google, setGoogle] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  // A session that expired keeps its writes on the phone; only its own account can send them (mobile spec 0003, D-k).
  const unsent = useMemo(() => {
    const last = lastAccount();
    const count = last ? unsentCount(last.userId) : 0;
    return last && count > 0 ? { count, email: last.email } : null;
  }, []);

  useEffect(() => {
    void signInOptions().then(setOptions);
  }, []);

  // Preview builds can deep-link a persona (A/B captures): /sign-in?as=housekeeper
  useEffect(() => {
    if (as && as in personas && Platform.OS === "web" && signInAs(as as Persona["id"])) {
      void refresh().then(() => router.replace("/"));
    }
  }, [as, refresh]);

  const begin = async (address: string) => {
    const typed = address.trim();
    if (!/^\S+@\S+\.\S+$/.test(typed)) {
      setError(typed ? SEND_ERRORS["invalid-email"] : "Enter your email to continue.");
      return;
    }
    // The phone apps are for the phone personas; a demo workspace person is told where they belong
    // before a code goes out.
    const person = options?.demo ? personaByEmail(typed) : undefined;
    if (person && person.app.kind !== "phone") {
      setError(
        `${person.firstName} works in the Injishi web workspace, not the phone app. Sign in on the web, or choose someone from Explore the demo.`,
      );
      return;
    }
    setSending(true);
    const sent = await requestCode(typed);
    setSending(false);
    if (!sent.ok) {
      setError(SEND_ERRORS[sent.reason]);
      return;
    }
    setError(null);
    router.push({ pathname: "/verify", params: { email: typed.toLowerCase(), demo: options?.demo ? "1" : "" } });
  };

  const continueWithGoogle = async () => {
    setGoogle({ busy: true, error: null });
    const result = await signInWithGoogle();
    if (result.ok) {
      await refresh();
      router.replace("/");
      return;
    }
    setGoogle({
      busy: false,
      error:
        result.reason === "cancelled"
          ? null
          : "Google sign-in didn’t finish, so you’re not signed in. Try again, or use your email.",
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      {/* A way back to where the person was browsing (mobile spec 0005, the guest shell child). */}
      {router.canGoBack() ? (
        <View className="absolute left-2 z-10" style={{ top: insets.top + 4 }}>
          <IconButton icon="ArrowLeft" label="Back" onPress={() => router.back()} />
        </View>
      ) : null}
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
        {unsent ? (
          <Card className="w-full bg-warning-soft">
            <Card.Body>
              <UiText role="body" accessibilityRole="alert">
                {`There ${unsent.count === 1 ? "is 1 unsent change" : `are ${unsent.count} unsent changes`} from ${unsent.email}. Sign in as them to send ${unsent.count === 1 ? "it" : "them"}.`}
              </UiText>
            </Card.Body>
          </Card>
        ) : null}

        <View className="w-full items-center gap-2">
          <Text className="text-[13px] text-muted">Continue with</Text>
          <Button
            variant="secondary"
            isDisabled={!options?.google || google.busy}
            className="w-full rounded-full"
            onPress={() => void continueWithGoogle()}
          >
            <Button.Label>{google.busy ? "Opening Google…" : "G Continue with Google"}</Button.Label>
          </Button>
          {options && !options.google ? (
            <Text className="text-xs text-muted">Sign in with Google is coming soon. Use your email for now.</Text>
          ) : null}
          {google.error ? (
            <Text accessibilityRole="alert" className="text-center text-xs text-danger">
              {google.error}
            </Text>
          ) : null}
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
          <Button variant="secondary" className="rounded-full" isDisabled={sending} onPress={() => void begin(email)}>
            <Button.Label>{sending ? "Sending your code…" : "Continue"}</Button.Label>
          </Button>
        </View>

        {options?.demo ? (
          <Card className="w-full gap-3 p-4">
            <Text className="text-[15px] font-semibold text-foreground">Explore the demo</Text>
            <Text className="text-[13px] leading-[18px] text-muted">
              Choose someone and sign in as them in one step. Typing an email by hand works too: every code is{" "}
              <Text className="font-semibold text-foreground">123456</Text>.
            </Text>
            {options.seededAt ? (
              <Text className="text-xs text-muted">Demo data last reset {resetLabel(options.seededAt)}</Text>
            ) : null}
            <Text className="pt-1 text-xs font-semibold tracking-wider text-muted uppercase">
              Staff devices and guests
            </Text>
            {PHONE_PERSONAS.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                onSignIn={() => void begin(p.email)}
                onUseEmail={() => setEmail(p.email)}
              />
            ))}
            <Text className="text-xs leading-4 text-muted">
              Owners, managers and back-office roles use the web workspace.
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
