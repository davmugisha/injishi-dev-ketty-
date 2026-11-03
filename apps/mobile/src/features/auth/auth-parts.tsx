// Parts of the sign in and verify screens: the logo over the hero photo, the "or" rule, the terms
// line, and the demo API's people (api mode on the demo stack only; sample data mode never lists them).

import { PERSONA_IDS, type Persona, personaByEmail, personas } from "@injishi/data";
import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";
import { Card, Icon, ListGroup, ListItem, metrics, Text } from "@/components/ui";

/** Phone apps on this device: housekeeping, supervisor, technician and guest. */
const PHONE_PERSONAS: Persona[] = PERSONA_IDS.map((id) => personas[id]).filter((p) => p.app.kind === "phone");

/** The demo person with this email, if any: a web workspace person is told where to sign in. */
export function demoPersonaByEmail(email: string): Persona | undefined {
  return personaByEmail(email);
}

/** `/sign-in?as=<persona>` names a demo persona (preview captures only). */
export function isDemoPersonaId(value: string): value is Persona["id"] {
  return value in personas;
}

/** "15 Oct, 03:00", in Kigali. */
export function resetLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Blur strength over the hero photo, out of 100: the prototype's thin light glass. */
const GLASS = 50;

/** The Injishi mark on the hero: sparkles on a frosted tile, then the name. Light on the photo. */
export function LogoMark() {
  return (
    <View className="flex-row items-center gap-2" accessible accessibilityRole="header" accessibilityLabel="Injishi">
      <View
        className="items-center justify-center overflow-hidden rounded-xl"
        style={{ width: metrics.iconButton, height: metrics.iconButton }}
      >
        <BlurView tint="default" intensity={GLASS} style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]} />
        <Icon name="Sparkles" size={20} />
      </View>
      <Text role="headline" strong>
        Injishi
      </Text>
    </View>
  );
}

/** A hairline, a few quiet words, a hairline: between Google and the email field. */
export function OrDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3 py-1">
      <View className="h-px flex-1 bg-separator" />
      <Text role="caption" tone="muted">
        {label}
      </Text>
      <View className="h-px flex-1 bg-separator" />
    </View>
  );
}

export function Terms() {
  return (
    <Text role="caption" tone="muted" className="mt-1 text-center">
      By continuing you agree to the{" "}
      <Text role="caption" strong>
        terms
      </Text>{" "}
      and{" "}
      <Text role="caption" strong>
        privacy policy
      </Text>
      .
    </Text>
  );
}

/**
 * The demo API's phone people, one tap from signed in: the code goes to their address and the code
 * step is filled in (every demo code is 123456). Never drawn against a real API.
 */
export function DemoPeople({ resetAt, onSignIn }: { resetAt: string | null; onSignIn: (email: string) => void }) {
  return (
    <Card tone="flat" className="mt-4">
      <View className="gap-1 pb-3">
        <View className="flex-row items-center gap-2">
          <Icon name="Sparkles" size={16} tone="accent" />
          <Text role="headline">Explore the demo</Text>
        </View>
        <Text role="callout" tone="muted">
          Choose someone to sign in as them in one step. Typing an email works too: every code is 123456.
        </Text>
        {resetAt ? (
          <Text role="caption" tone="muted">
            {`Demo data last reset ${resetAt}`}
          </Text>
        ) : null}
      </View>
      <ListGroup>
        {PHONE_PERSONAS.map((p) => (
          <ListItem
            key={p.id}
            title={p.name}
            subtitle={`${p.headline} · ${p.role}`}
            onPress={() => onSignIn(p.email)}
            accessibilityLabel={`Sign in as ${p.firstName}, ${p.headline}`}
          />
        ))}
      </ListGroup>
      <Text role="caption" tone="muted" className="pt-3">
        Owners, managers and back-office roles use the web workspace.
      </Text>
    </Card>
  );
}
