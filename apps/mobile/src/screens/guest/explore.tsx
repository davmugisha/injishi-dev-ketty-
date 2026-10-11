/**
 * Explore — the Hospitality-demand home: public stay discovery for the Guest.
 * Guest canvas artboard 3 (`Explore.dc.html`, `ExploreDark.dc.html`, `explore`
 * in `screens-a.mjs`). Rendered by the home tab when the surface is `guest`.
 *
 * Only Hospitality inventory is explorable; Residence units are reachable only
 * through the Broker Directory tab, never here. An inactive property is not
 * explorable either — `EXPLORABLE_STAYS` is what this reads.
 *
 * ## The four states, and why they are real code
 *
 * `useFixture` gives the read the shape the API read will have, so the skeleton
 * and the failure branch are exercised rather than added later. The empty state
 * is **per filter**: `emptyReason` drops each active filter in turn and reports
 * the one that, alone, brings results back, so the screen can name the filter
 * that emptied the list and offer to clear exactly that one. "No stays match"
 * with a Clear all button is a dead end when the reader only needed the price
 * band widened. Offline is a state and not an error (frames.md): the shell's
 * banner says the connection is gone and a note here says the list is the last
 * one that loaded, and neither blocks anything.
 *
 * ## The search lives in the store, not in this component
 *
 * `app/search.tsx` is a different route. A sheet that dismisses takes component
 * state with it, so the committed search is held by `useStaySearch` in the
 * fixture store and both screens read the same object. The quick rail writes
 * the same two fields the sheet writes — see `src/data/search.ts`, decision 2 —
 * so which quick chip reads as selected is derived and the two can never
 * disagree.
 *
 * ## Two things the artboard settles that a reader might expect otherwise
 *
 * There is **no "Near you" or "Tonight" rail**: the session prompt allows one
 * if the artboard draws one, and artboard 3 draws a search pill, a chip rail, a
 * section label and the cards, in that order. Nothing was invented to fill the
 * space.
 *
 * The **map is drawn rather than mapped**, and says so on itself. F-B04's own
 * open question is which provider to use, no map dependency is installed, and
 * this session may not add one. See `explore-map.tsx`.
 *
 * ## Whose name is in the greeting
 *
 * The person's own, from `useMyIdentity()`, and only once the server has given
 * one. Anything else greets with "Muraho" alone: the line used to read the
 * fixture persona and greeted every account as Samuel (mobile audit
 * 2026-10-05, GB-02).
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SectionLabel,
  SegmentedTabs,
  Text,
  useOffline,
  useToast,
  WorkspaceChip,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { useSavedStays } from '@/data/saved';
import { EXPLORABLE_STAYS, type Stay } from '@/data/stays';
import { useMyIdentity } from '@/queries/profile';
import {
  DEFAULT_SEARCH,
  SORT_LABEL,
  activeFilterCount,
  emptyReason,
  searchStays,
  summariseSearch,
  useStaySearch,
  type StaySearch,
} from '@/data/search';
import { ActiveFilterChips, QuickRail, SearchPill, activeChips } from './explore-chips';
import { ExploreStayCard } from './explore-stay-card';
import { ExploreMap } from './explore-map';

/** Which of the two F-B04 views is on screen. */
type ResultView = 'list' | 'map';

export function Explore() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace } = useDomain();
  const toast = useToast();

  const { search, setSearch } = useStaySearch();
  const { isSaved, toggle } = useSavedStays();
  const [view, setView] = useState<ResultView>('list');
  const me = useMyIdentity();

  const stays = useFixture('stays', () => EXPLORABLE_STAYS);
  const catalogue = stays.data ?? [];
  const results = useMemo(() => searchStays(search, catalogue), [search, catalogue]);

  const offline = useOffline();

  const summary = summariseSearch(search, t);
  const untouched = summary === t('explore.searchPlaceholder');
  const chips = activeChips(search, t);
  const showMap = view === 'map';

  const openStay = (stay: Stay) =>
    router.push({ pathname: '/listing/[id]', params: { id: stay.id } });

  /**
   * The heart flips at once; the toast waits for the write. It used to be
   * picked from the intent, so a save that failed still said "Saved" (brief
   * item 1). Offline, the press is queued, and the toast says that instead.
   */
  const onToggleSave = (stay: Stay) => {
    const { next, settled } = toggle(stay.id);
    void settled.then((outcome) => {
      if (outcome === 'done') {
        toast.show(
          next ? t('explore.savedToast') : t('explore.unsavedToast'),
          next ? 'success' : 'neutral',
        );
      } else if (outcome === 'queued') {
        toast.show(next ? t('saved.queuedSave') : t('saved.queuedRemove'), 'neutral');
      } else {
        toast.show(t('saved.toggleFailed'), 'danger');
      }
    });
  };

  // The first name only, and only from the server. See the header (GB-02).
  const greeting = me.fromServer
    ? t('explore.greeting', { name: me.name.split(/\s+/)[0] })
    : t('explore.greetingNoName');

  return (
    <Screen.List<Stay>
      greeting={greeting}
      title={t('explore.title')}
      action={
        <WorkspaceChip
          name={workspace.name}
          role={workspace.role}
          onPress={() => router.push('/switch')}
        />
      }
      header={
        <>
          {offline ? <OfflineNote /> : null}

          <SearchPill
            summary={summary}
            filled={!untouched}
            filterCount={activeFilterCount(search)}
            onPress={() => router.push('/search')}
          />

          <QuickRail
            search={search}
            onChange={setSearch}
            onOpenFilters={() => router.push('/search')}
          />

          <ActiveFilterChips chips={chips} onChange={setSearch} />

          {/* The pair is what carries the "one of these two views" meaning;
              `SegmentedTabs` reports each tab and cannot name the group. */}
          <View accessibilityRole="tablist" accessibilityLabel={t('explore.view')}>
            <SegmentedTabs
              items={[
                // No count until the list has loaded: "List 0" while the read
                // is in flight is a misleading zero (mobile audit 2026-10-05,
                // GB-18; the rig found the same on the Directory chips).
                {
                  value: 'list',
                  label: t('explore.viewList'),
                  count: stays.data ? results.length : undefined,
                },
                { value: 'map', label: t('explore.viewMap') },
              ]}
              value={view}
              onChange={(next) => setView(next as ResultView)}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: space[2],
            }}
          >
            <SectionLabel>{t('explore.sectionStays')}</SectionLabel>
            {!stays.data ? null : (
              <Text size="xs" color="textMuted">
                {`${
                  results.length === 1
                    ? t('explore.resultsOne')
                    : t('explore.resultsCount', { count: results.length })
                } · ${t(SORT_LABEL[search.sort])}`}
              </Text>
            )}
          </View>

          {/* In map view the rows are empty and the map takes their place, so
              the one scroller still owns the whole page. */}
          {showMap && results.length > 0 ? (
            <ExploreMap stays={results} onOpen={openStay} />
          ) : null}
        </>
      }
      data={showMap ? [] : results}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => (
        <ExploreStayCard
          stay={item}
          saved={isSaved(item.id)}
          onToggleSave={() => onToggleSave(item)}
          onPress={() => openStay(item)}
        />
      )}
      loading={stays.status === 'loading'}
      loadingLabel={t('state.loadingList', { label: t('explore.listLabel') })}
      loadingRows={3}
      empty={
        stays.status === 'error' ? (
          // No `detail`: it printed the server's raw text ("Not Found") under
          // the sentence (mobile audit 2026-10-05, GB-27).
          <ErrorState
            title={t('state.errorTitle')}
            body={t('state.errorBody', { label: t('explore.listLabel') })}
            onRetry={stays.retry}
          />
        ) : results.length === 0 ? (
          <NoResults search={search} catalogue={catalogue} onChange={setSearch} />
        ) : null
      }
    />
  );

  function OfflineNote() {
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={t('state.offlineLastList')}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[2],
          padding: space[3],
          borderRadius: 10,
          backgroundColor: c.warning100,
        }}
      >
        <Icon name="wifiOff" size={16} color={c.warning600} />
        <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
          {t('state.offlineLastList')}
        </Text>
      </View>
    );
  }
}

/**
 * The empty state, in the three flavours it actually has. They are three
 * different facts and a single "nothing found" would be a lie in two of them.
 */
function NoResults({
  search,
  catalogue,
  onChange,
}: {
  search: StaySearch;
  catalogue: Stay[];
  onChange: (next: StaySearch) => void;
}) {
  const t = useT();
  const reason = emptyReason(search, catalogue);

  // One filter is responsible, and it can be named and lifted on its own.
  if (reason) {
    const filter = t(reason.label);
    return (
      <EmptyState
        icon="filter"
        title={t('explore.emptyFilterTitle', { filter })}
        body={t('explore.emptyFilterBody')}
        action={
          <Button variant="outline" size="md" onPress={() => onChange(reason.clear(search))}>
            {t('explore.emptyFilterAction', { filter })}
          </Button>
        }
      />
    );
  }

  // Filters are set but no single one explains it: it is the combination.
  if (activeFilterCount(search) > 0) {
    return (
      <EmptyState
        icon="filter"
        title={t('explore.emptyAllTitle')}
        body={t('explore.emptyAllBody')}
        action={
          <Button variant="outline" size="md" onPress={() => onChange(DEFAULT_SEARCH)}>
            {t('explore.emptyAllAction')}
          </Button>
        }
      />
    );
  }

  // Nothing is filtered, so the catalogue itself is empty.
  return (
    <EmptyState
      icon="search"
      title={t('explore.emptyTitle')}
      body={t('explore.emptyBody')}
      action={
        <Button variant="outline" size="md" onPress={() => onChange(DEFAULT_SEARCH)}>
          {t('explore.emptyAction')}
        </Button>
      }
    />
  );
}
