/**
 * Screen — the page scaffold, in two modes.
 *
 * `<Screen>` is the original: a `ScrollView` on the app canvas with a large
 * serif title header (optional greeting and trailing action), safe-area aware.
 * Use it for prose, forms and dashboards — anything whose length is bounded by
 * how the page is written rather than by how much data exists.
 *
 * `<Screen.List>` is the same page with a virtualized list in place of the
 * scroller (ADR-031 child "list virtualization"). Use it when the body is a
 * repeating row that grows with real inventory. It exists because the scaffold
 * owns the outer scroller: a list placed inside `<Screen>` would nest one
 * scroller in another and lose virtualization entirely, so the list has to *be*
 * the scroller and the title block has to move into its header slot.
 *
 * **Picking wrong is silent.** A list rendered in the scroll variant still
 * works, it just renders every row at once. Explore, Directory, Trips and
 * Leases are the precedent to copy; Portfolio and Rent are the precedent for
 * staying on `<Screen>`, because their repeating rows live inside one `Card`
 * and are bounded by construction.
 *
 * Neither variant reads the session, the domain or the locale. This is a layout
 * primitive, and a scaffold that reaches into providers cannot be rendered in a
 * test without mounting the whole app.
 */
import { type ReactElement, type ReactNode } from 'react';
import { View, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { SkeletonList } from './skeleton';
import { useTheme } from '@/theme/theme';

/**
 * The status-bar scrim, painted over the scroller in the app's own ground.
 *
 * Android is edge-to-edge from SDK 54 and iOS has always drawn under the
 * status bar, so a scroller occupies the full window and its content passes
 * BEHIND the clock and the battery on the way up. `contentContainerStyle`'s
 * `paddingTop` positions the first frame correctly and then scrolls away with
 * everything else, which is why the Account header — a 26pt serif title and the
 * workspace chip beside it — ended up interleaved with the system icons the
 * moment the page was long enough to move.
 *
 * A band of `bgApp` at exactly `insets.top` is the fix the platform expects:
 * content now disappears UNDER an opaque strip in the app's own colour instead
 * of colliding with white system glyphs. `pointerEvents="none"` so it never
 * takes a touch away from whatever scrolls beneath it, and it is rendered after
 * the scroller so it paints on top without needing a `zIndex`.
 *
 * It lives in the scaffold rather than in each screen because "the one place
 * every screen gets this wrong" is the whole reason the scaffold exists.
 */
function StatusBarScrim() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (!insets.top) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: c.bgApp,
      }}
    />
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      weight="bold"
      size="xs"
      color="textMuted"
      style={{ letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}
    >
      {children}
    </Text>
  );
}

/** What both variants put at the top of the page. Identical in either mode. */
interface TitleProps {
  title?: string;
  greeting?: string;
  action?: ReactNode;
  /**
   * Leave room on the left for a `BackHeader` floating over the title, which
   * otherwise covers its first letters. Opt in, so no existing screen moves.
   */
  backInset?: boolean;
}

function TitleBlock({ title, greeting, action, backInset }: TitleProps) {
  const { space } = useTheme();
  if (!title) return null;

  return (
    <View
      style={{
        paddingHorizontal: space[4],
        // The back button is 38pt wide at left 14; the title starts past it.
        ...(backInset ? { paddingLeft: 14 + 38 + space[3] } : {}),
        paddingBottom: space[3],
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <View style={{ flexShrink: 1 }}>
        {greeting ? (
          <Text size="sm" color="textMuted" style={{ marginBottom: 2 }}>
            {greeting}
          </Text>
        ) : null}
        <Text
          family="display"
          weight="semibold"
          size="2xl"
          color="textStrong"
          style={{ letterSpacing: -0.4 }}
        >
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

export function Screen({
  title,
  greeting,
  action,
  backInset,
  children,
}: TitleProps & { children: ReactNode }) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space[2],
          paddingBottom: insets.bottom + space[8],
        }}
        showsVerticalScrollIndicator={false}
      >
        <TitleBlock title={title} greeting={greeting} action={action} backInset={backInset} />
        <View style={{ paddingHorizontal: space[4], gap: space[4] }}>{children}</View>
      </ScrollView>
      <StatusBarScrim />
    </View>
  );
}

interface ListProps<T> extends TitleProps {
  data: readonly T[];
  renderItem: (info: { item: T; index: number }) => ReactElement;
  keyExtractor: (item: T, index: number) => string;
  /**
   * Per-screen content between the title block and the rows: Explore's search
   * field and filters, Directory's filters, Trips' tabs, Leases' unsigned block
   * plus tabs. It scrolls with the content exactly as it does in `<Screen>`.
   *
   * A horizontal `ScrollView` in here is fine and is what Explore and Directory
   * already do for their filter rows: nesting a horizontal scroller inside a
   * vertical list is supported and keeps virtualization.
   */
  header?: ReactNode;
  /** What renders instead of rows when there are none. */
  empty?: ReactNode;
  loading?: boolean;
  /**
   * What a screen reader hears while the rows load. Required in practice
   * whenever `loading` can be true: the scaffold renders the skeleton but must
   * not read the locale to name it, so the copy comes from the caller.
   */
  loadingLabel?: string;
  /** Skeleton rows to draw. Match what the real list usually holds. */
  loadingRows?: number;
}

function ScreenList<T>({
  title,
  greeting,
  action,
  data,
  renderItem,
  keyExtractor,
  header,
  empty,
  loading = false,
  loadingLabel = '',
  loadingRows = 3,
}: ListProps<T>) {
  const { c, space } = useTheme();
  const insets = useSafeAreaInsets();

  // While the read is in flight there are no rows to draw, so the skeleton
  // takes the empty slot rather than sitting above a list that is not there.
  const rows = loading ? [] : data;
  const emptySlot = loading ? <SkeletonList rows={loadingRows} label={loadingLabel} /> : empty;

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <FlashList
        data={rows as T[]}
        renderItem={({ item, index }) => (
          // The horizontal inset that wraps children in `<Screen>` applies per
          // row here, so a row keeps the same edge margin it has today.
          <View style={{ paddingHorizontal: space[4] }}>{renderItem({ item, index })}</View>
        )}
        keyExtractor={keyExtractor}
        // v2 measures rows itself. Do NOT add `estimatedItemSize`; that is a v1
        // prop and copying it from a v1 example is the easy mistake here.
        ListHeaderComponent={
          <View style={{ marginBottom: space[4] }}>
            <TitleBlock title={title} greeting={greeting} action={action} />
            {header ? (
              <View style={{ paddingHorizontal: space[4], gap: space[4] }}>{header}</View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          emptySlot ? <View style={{ paddingHorizontal: space[4] }}>{emptySlot}</View> : null
        }
        // The 16px row gap `<Screen>` gets from its `gap`, as a separator: a
        // virtualized list lays its rows out itself and never sees that style.
        ItemSeparatorComponent={() => <View style={{ height: space[4] }} />}
        contentContainerStyle={{
          paddingTop: insets.top + space[2],
          paddingBottom: insets.bottom + space[8],
        }}
        showsVerticalScrollIndicator={false}
      />
      <StatusBarScrim />
    </View>
  );
}

Screen.List = ScreenList;
