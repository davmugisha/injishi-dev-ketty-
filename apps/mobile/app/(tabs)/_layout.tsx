/**
 * Bottom tab navigator. **One route tree, six tab sets**, chosen by the active
 * surface; the other five sets' tabs are unlinked (`href: null`) rather than
 * living in six separate apps.
 *
 *   guest     Explore · Trips · Saved · Inbox · Account
 *   tenant    Leases · Rent · Inbox · Account
 *   landlord  Rent roll · Leases · Repairs · Account
 *   broker    Directory · Placements · Earnings · Account
 *   work      Queue · Rooms · Tickets · Account
 *   host      Today · Bookings · Inbox · Account
 *
 * These are `frames.md` "Shell", and they supersede ADR-032 (which named two
 * sets) and `mobile-design-brief.md` §9.1 (which named three per domain).
 * Session 12 corrects both records; decision D3 is where the disagreement is
 * written down. **Account is the only tab in every set**, which is the whole
 * reason the switcher is safe: the tab you are standing on is never the one a
 * switch is about to unlink.
 *
 * Two structural decisions worth knowing before editing this file:
 *
 * **1. `index` is the home tab of every set.** It renders the surface's first
 * screen — Explore for guest, Leases for tenant, Rent roll for landlord, and so
 * on — so the navigator always has a linked initial route whichever surface is
 * active. `rent-roll`, `queue`, `today` and `directory` therefore exist as
 * route FILES but are never linked: their content is already on `index` for
 * their own surface, and the file keeps `/rent-roll` resolving for a deep link
 * or a `router.push` written against it. `leases` is the exception that proves
 * it — unlinked for tenant, who reaches it through `index`, and linked for
 * landlord, where it is the second tab.
 *
 * **2. The declaration order below satisfies all six sets at once.** Expo
 * Router draws tabs in the order they are declared, and the sets disagree about
 * what sits in the middle. `index` first, `account` last, and the middle
 * ordered so that every set's own subsequence comes out right: trips, saved,
 * rent, leases, maintenance, placements, earnings, rooms, tickets,
 * reservations, inbox. Check a new tab against all six sets before inserting
 * it, because a wrong position is invisible on five of them.
 *
 * The Work set draws taller, per frame W1's note: it is used one-handed,
 * gloved, standing, in corridors. Larger targets, larger glyphs, and the label
 * drops to 12.5 so the longer Kinyarwanda words still fit on one line (W8).
 *
 * **3. The heights below are CONTENT heights; the system inset is added to
 * them.** React Navigation reads `height` straight out of `tabBarStyle` and
 * returns it as the bar's TOTAL, skipping the `+ insets.bottom` it applies to
 * its own default (`getTabBarHeight`, BottomTabBar.tsx). It then still lays the
 * bar out with `paddingBottom: insets.bottom`. A flat number here therefore
 * SPENDS the inset rather than clearing it: on Android 3-button navigation the
 * 48dp system bar took most of the 72dp Work bar, leaving a ~16dp box that the
 * icons overflowed and the labels sat behind. Adding `insets.bottom` to the
 * height, and declaring the matching `paddingBottom`, makes the numbers below
 * the space an icon and its label actually get on every device. Edge-to-edge is
 * the default on Android from SDK 54, so this is not an edge case.
 *
 * **Frozen after Session 0** (MOBILE-PROTOTYPE-PROMPTS.md Part 3). Every icon
 * resolves through `src/components/icon.tsx`; no Feather name appears here.
 *
 * **One exception, added by Session 6: the Inbox badge.** ADR-032's AC-16 says
 * opening a thread clears the row's dot AND the tab badge without a manual
 * refresh, which is only possible if the tab bar and the Inbox screen read one
 * store rather than each counting for themselves. `useInboxCounts` is that
 * store. The change here is a single `tabBarBadge` on the inbox row and nothing
 * else; the hook is safe to call for every surface, so no branch was added.
 *
 * `badge` is `undefined`, never `0` — React Navigation draws the pill for any
 * defined value, so a zero would put a permanent mark on the tab saying nothing
 * is waiting. The hook returns `undefined` rather than leaving that check to
 * this file.
 */
import { Tabs } from 'expo-router';
import { type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, tabBarContentHeight, type IconName } from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useInboxCounts } from '@/data/inbox-unread';
import { useT, type MessageKey, type Translate } from '@/i18n/i18n';
import type { Surface } from '@/data/rentals';

/** What `index` is called and drawn as, per surface. */
const HOME: Record<Surface, { label: MessageKey; icon: IconName }> = {
  guest: { label: 'nav.explore', icon: 'compass' },
  tenant: { label: 'nav.leases', icon: 'fileText' },
  landlord: { label: 'nav.rentRoll', icon: 'coins' },
  broker: { label: 'nav.directory', icon: 'grid' },
  work: { label: 'nav.queue', icon: 'sparkles' },
  host: { label: 'nav.today', icon: 'sun' },
};

/** Which surfaces link each middle tab. Everything else gets `href: null`. */
const LINKED: Record<string, readonly Surface[]> = {
  trips: ['guest'],
  saved: ['guest'],
  rent: ['tenant'],
  leases: ['landlord'],
  maintenance: ['landlord'],
  placements: ['broker'],
  earnings: ['broker'],
  rooms: ['work'],
  tickets: ['work'],
  reservations: ['host'],
  inbox: ['guest', 'tenant', 'host'],
};

interface MiddleTab {
  name: keyof typeof LINKED;
  label: MessageKey;
  icon: IconName;
}

/**
 * The middle tabs, in the one order that satisfies every set. See note 2 above
 * before moving a row.
 */
const MIDDLE: MiddleTab[] = [
  { name: 'trips', label: 'nav.trips', icon: 'calendar' },
  { name: 'saved', label: 'nav.saved', icon: 'heart' },
  { name: 'rent', label: 'nav.rent', icon: 'wallet' },
  { name: 'leases', label: 'nav.leases', icon: 'fileText' },
  { name: 'maintenance', label: 'nav.repairs', icon: 'wrench' },
  { name: 'placements', label: 'nav.placements', icon: 'key' },
  { name: 'earnings', label: 'nav.earnings', icon: 'coins' },
  { name: 'rooms', label: 'nav.rooms', icon: 'bed' },
  { name: 'tickets', label: 'nav.tickets', icon: 'flag' },
  { name: 'reservations', label: 'nav.reservations', icon: 'calendar' },
  { name: 'inbox', label: 'nav.inbox', icon: 'inbox' },
];

/**
 * Registered, never drawn: `index` already serves the screen for that surface.
 * Each opens only for its own surface, so `injishi://queue` no longer shows a
 * guest the Work queue (mobile audit 2026-10-05, SA-12).
 */
const UNLINKED: { name: string; label: MessageKey; surface: Surface }[] = [
  { name: 'queue', label: 'nav.queue', surface: 'work' },
  { name: 'today', label: 'nav.today', surface: 'host' },
];

/**
 * Registered and refused for every seat. `rent-roll` and `directory` were
 * duplicates of `index` that left no tab highlighted (ADR-044 AC-17), and
 * `portfolio` is the screen ADR-044 decided to delete. Hidden here rather than
 * deleted; removing the files is the owner's call.
 */
const RETIRED: { name: string; label: MessageKey }[] = [
  { name: 'rent-roll', label: 'nav.rentRoll' },
  { name: 'directory', label: 'nav.directory' },
  { name: 'portfolio', label: 'nav.portfolio' },
];

/**
 * expo-router 57 types `tabBarIcon`'s `color` as React Native's `ColorValue`,
 * a union wider than the plain string the design-system `Icon` takes. icon.tsx
 * is frozen after Session 0, so the narrowing belongs here. The tab bar only
 * ever hands over a string; falling back to `undefined` lets Icon apply its own
 * default rather than asserting a colour that is not there.
 */
const iconColor = (color: ColorValue) => (typeof color === 'string' ? color : undefined);

export default function TabsLayout() {
  const { c, font } = useTheme();
  const { surface } = useDomain();
  const t: Translate = useT();
  // The Inbox badge. See the note above about `undefined` versus `0`.
  const inbox = useInboxCounts(surface);
  const home = HOME[surface];
  // Frame W1: used one-handed, gloved, standing. Larger targets than the rest.
  const work = surface === 'work';
  const insets = useSafeAreaInsets();
  // Content height, above the system inset. See note 3 above before changing a
  // number: iOS keeps the 88/96 it draws today on a home-indicator phone
  // (54 + 34, 62 + 34) and stops over-drawing on one without.
  // One source with the footers that sit on this bar (`pinned-footer.ts`).
  const barContent = tabBarContentHeight(work);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Android resizes the window when the soft keyboard opens, which lifts
        // a bottom-anchored tab bar up the screen and parks it on top of the
        // keyboard — the bar "hanging upwards instead of staying where it
        // belongs". Hiding it while the keyboard is up is the platform answer,
        // and it is what every Android app with a bottom bar does. iOS does not
        // resize the window, so this is a no-op there.
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: c.textStrong,
        tabBarInactiveTintColor: c.textSubtle,
        tabBarStyle: {
          backgroundColor: c.surface1,
          borderTopColor: c.borderSubtle,
          borderTopWidth: 1,
          height: barContent + insets.bottom,
          paddingTop: work ? 8 : 6,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontFamily: font.bodySemibold,
          // 12.5 on Work per W8's note that the Kinyarwanda labels are longer;
          // the smaller default keeps five English labels on one line.
          fontSize: work ? 12.5 : 10.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t(home.label),
          tabBarIcon: ({ color, size }) => (
            <Icon name={home.icon} size={work ? size + 3 : size} color={iconColor(color)} />
          ),
        }}
      />

      {/* A tab outside this surface's set is PROTECTED, not merely unlinked:
          `href: null` hid the button and left the route open to any link.
          Protected, it refuses before its screen mounts, and a seat switch
          that closes the open tab lands on `index` (mobile audit SA-12). */}
      {MIDDLE.map((tab) => (
        <Tabs.Protected key={tab.name} guard={LINKED[tab.name].includes(surface)}>
          <Tabs.Screen
            name={tab.name}
            options={{
              title: t(tab.label),
              tabBarBadge: tab.name === 'inbox' ? inbox.badge : undefined,
              tabBarAccessibilityLabel:
                tab.name === 'inbox' && inbox.badge !== undefined
                  ? `${t(tab.label)}, ${t('inbox.badgeLabel', { count: inbox.badge })}`
                  : undefined,
              tabBarIcon: ({ color, size }) => (
                <Icon name={tab.icon} size={work ? size + 3 : size} color={iconColor(color)} />
              ),
            }}
          />
        </Tabs.Protected>
      ))}

      {UNLINKED.map((tab) => (
        <Tabs.Protected key={tab.name} guard={tab.surface === surface}>
          <Tabs.Screen name={tab.name} options={{ title: t(tab.label), href: null }} />
        </Tabs.Protected>
      ))}

      <Tabs.Protected guard={false}>
        {RETIRED.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(tab.label), href: null }} />
        ))}
      </Tabs.Protected>

      {/* The one tab in every set, and therefore the one the switcher can
          always land on. Last on purpose: it is the escape, not a destination. */}
      <Tabs.Screen
        name="account"
        options={{
          title: t('nav.account'),
          tabBarIcon: ({ color, size }) => (
            <Icon name="user" size={work ? size + 3 : size} color={iconColor(color)} />
          ),
        }}
      />
    </Tabs>
  );
}
