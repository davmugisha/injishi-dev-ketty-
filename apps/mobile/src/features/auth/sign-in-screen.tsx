import { rnSpace } from "@injishi/design-tokens";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { Banner, Button, IconButton, Input, metrics, PhotoHero, Screen, Text } from "@/components/ui";
import { unsentCount } from "@/data/outbox/store";
import { lastAccount, requestCode, type SignInOptions, signInAs, signInOptions, signInWithGoogle } from "@/lib/auth";
import { isMock } from "@/lib/data-mode";
import { useSession } from "@/lib/session";
import { href } from "@/proto/screens";
import { protoSignIn } from "@/proto/session";
import { DemoPeople, demoPersonaByEmail, isDemoPersonaId, LogoMark, OrDivider, resetLabel, Terms } from "./auth-parts";

const SEND_ERRORS = {
  "invalid-email": "That doesn’t look like an email address.",
  "too-many": "Too many codes for this email. Wait an hour, or use the newest code we sent.",
  unavailable: "We couldn’t reach Injishi to send your code. Check your connection and try again.",
} as const;

/** The prototype's sample address, filled in on sample data so the flow is one tap. */
const SAMPLE_EMAIL = "sarah.kimani@gmail.com";

/** The hero runs under the status bar to a little below the middle of the phone. */
const HERO_HEIGHT = metrics.photo.bleed + rnSpace[10];

/**
 * Sign in (prototype `shared-signin`): one sign-in for guests, residents and staff, Google or an
 * emailed code, no passwords. A photo hero with the promise, then a sheet with the two ways in.
 *
 * Api mode is Better Auth through `lib/auth.ts`, as before the restyle: the code is mailed by the API
 * and the verify screen checks it; Google returns through the build's deep link; the start route then
 * opens the step up when it is owed, the page a guest came from, or the person's app. On the demo
 * API the phone personas are listed, one tap each. Sample data mode needs no API: any email goes on
 * to the code step, and Google signs in as the sample guest.
 */
export function SignInScreen() {
  const { as } = useLocalSearchParams<{ as?: string }>();
  const { refresh } = useSession();
  const [email, setEmail] = useState(isMock ? SAMPLE_EMAIL : "");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState<SignInOptions | null>(
    isMock ? { demo: false, seededAt: null, google: true } : null,
  );
  const [google, setGoogle] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  // A session that expired keeps its writes on the phone; only its own account can send them (mobile spec 0003, D-k).
  const unsent = useMemo(() => {
    if (isMock) return null;
    const last = lastAccount();
    const count = last ? unsentCount(last.userId) : 0;
    return last && count > 0 ? { count, email: last.email } : null;
  }, []);

  useEffect(() => {
    if (!isMock) void signInOptions().then(setOptions);
  }, []);

  // Preview builds can deep-link a persona (A/B captures): /sign-in?as=housekeeper
  useEffect(() => {
    if (!isMock && as && isDemoPersonaId(as) && Platform.OS === "web" && signInAs(as)) {
      void refresh().then(() => router.replace("/"));
    }
  }, [as, refresh]);

  const begin = async (address: string) => {
    const typed = address.trim();
    if (!/^\S+@\S+\.\S+$/.test(typed)) {
      setError(typed ? SEND_ERRORS["invalid-email"] : "Enter your email to continue.");
      return;
    }
    if (isMock) {
      setError(null);
      router.push(href("shared-verify", { email: typed.toLowerCase() }));
      return;
    }
    // The phone apps are for the phone personas; a demo workspace person is told where they belong
    // before a code goes out.
    const person = options?.demo ? demoPersonaByEmail(typed) : undefined;
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
    router.push(href("shared-verify", { email: typed.toLowerCase(), demo: options?.demo ? "1" : "" }));
  };

  const continueWithGoogle = async () => {
    if (isMock) {
      protoSignIn("guest");
      router.replace(href("guest-home-stay"));
      return;
    }
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
    <Screen bleed>
      <PhotoHero
        source={require("../../../assets/sign-in-hero.jpg")}
        height={HERO_HEIGHT}
        scrim="bleed"
        top={
          <View className="flex-row items-center gap-2">
            {/* A way back to where the person was browsing (mobile spec 0005, the guest shell child). */}
            {router.canGoBack() ? (
              <IconButton icon="ChevronLeft" label="Back" variant="glass" onPress={() => router.back()} />
            ) : null}
            <LogoMark />
          </View>
        }
      >
        <Text role="title1" accessibilityRole="header">
          {"Stays, leases and\nwork, in one app"}
        </Text>
        <Text role="callout">Book across Rwanda, live in your home, or run your shift.</Text>
        <View className="h-6" />
      </PhotoHero>

      <View className="-mt-6 gap-3 rounded-t-4xl bg-background px-5 pt-6">
        {unsent ? (
          <Banner
            tone="warning"
            icon="CloudSlash"
            title={unsent.count === 1 ? "1 unsent change" : `${unsent.count} unsent changes`}
            body={`From ${unsent.email}. Sign in as them to send ${unsent.count === 1 ? "it" : "them"}.`}
          />
        ) : null}

        <Button
          variant="outline"
          size="lg"
          icon="Globe"
          isDisabled={!options?.google || google.busy}
          onPress={() => void continueWithGoogle()}
        >
          {google.busy ? "Opening Google…" : "Continue with Google"}
        </Button>
        {options && !options.google ? (
          <Text role="caption" tone="muted" className="text-center">
            Google sign-in isn’t available on this server. Use your email.
          </Text>
        ) : null}
        {google.error ? (
          <Text role="caption" tone="danger" accessibilityRole="alert" className="text-center">
            {google.error}
          </Text>
        ) : null}

        <OrDivider label="or with your email" />

        <Input
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (error) setError(null);
          }}
          leading="Envelope"
          placeholder="you@example.com"
          invalid={Boolean(error)}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={() => void begin(email)}
        />
        {error ? (
          <Text role="caption" tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button size="lg" isDisabled={sending} onPress={() => void begin(email)}>
          {sending ? "Sending your code…" : "Send me a code"}
        </Button>
        <Terms />

        {options?.demo ? (
          <DemoPeople
            resetAt={options.seededAt ? resetLabel(options.seededAt) : null}
            onSignIn={(address) => void begin(address)}
          />
        ) : null}
      </View>
    </Screen>
  );
}
