import { Redirect, Stack } from "expo-router";
import { useCSSVariable } from "uniwind";
import { UiSurface, type UiSurfaceKind } from "@/components/ui";
import { DATA_MODE } from "@/lib/data-mode";
import { useSession } from "@/lib/session";
import { guardFor } from "./guard-rules";
import { type AppKey, SCREEN_IDS, SCREENS } from "./screens";

/**
 * A route drawn over the screen beneath it: an app's sheets (outer Stack) and the root modals
 * (`/switcher`, `/test-money`). The navigator adds no backdrop and no card; the screen paints its own
 * scrim and sheet (the kit's `SheetScreen`) and closes with `router.back()`.
 */
export const OVERLAY_OPTIONS = {
  presentation: "transparentModal",
  animation: "fade",
  contentStyle: { flex: 1, backgroundColor: "transparent" },
} as const;

/** The theme's page colour, read live, so a Stack's card matches the screen (the manager app is dark). */
export function useThemeBackground(): string | undefined {
  const value = useCSSVariable("--color-background");
  return typeof value === "string" ? value : undefined;
}

/** Staff and desk work one handed: their buttons default to 56 high (`UiSurface`, mobile spec 0002). */
const SURFACE: Record<AppKey, UiSurfaceKind> = {
  guest: "guest",
  housekeeper: "staff",
  supervisor: "staff",
  technician: "staff",
  resident: "resident",
  manager: "manager",
  desk: "desk",
};

/** The app's sheets, as route names of its outer Stack (`/housekeeper/found` is `found`). */
function sheetsOf(app: AppKey): string[] {
  const prefix = `/${app}/`;
  return SCREEN_IDS.map((id) => SCREENS[id])
    .filter((s) => s.kind === "sheet" && s.path.startsWith(prefix))
    .map((s) => s.path.slice(prefix.length));
}

/**
 * One app's outer Stack (proto-ui, PLAN.md "Routes"): the tabs first, then the screens that cover the
 * tab bar, with the app's sheets presented over whatever is beneath. In api mode the app's guard runs
 * first (`guard-rules.ts`); in mock mode every app is open.
 */
export function AppStack({ app }: { app: AppKey }) {
  const { status, persona, stepUpOwed } = useSession();
  const background = useThemeBackground();
  const verdict = guardFor(app, { mode: DATA_MODE, status, personaId: persona?.id ?? null, stepUpOwed });
  if (verdict.kind === "wait") return null;
  if (verdict.kind === "redirect") return <Redirect href={verdict.to} />;
  return (
    <UiSurface kind={SURFACE[app]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { flex: 1, backgroundColor: background } }}>
        <Stack.Screen name="(tabs)" />
        {sheetsOf(app).map((name) => (
          <Stack.Screen key={name} name={name} options={OVERLAY_OPTIONS} />
        ))}
      </Stack>
    </UiSurface>
  );
}

/** A tab's own Stack: its root, then the screens pushed inside the tab, with the tab bar still showing. */
export function TabStack() {
  const background = useThemeBackground();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { flex: 1, backgroundColor: background } }} />;
}
