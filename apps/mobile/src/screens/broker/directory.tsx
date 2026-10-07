/**
 * Directory — frame B21, and the Broker surface's home screen.
 *
 * **This tab is the only place a Residence unit appears.** F-R01 is the reason
 * the screen exists at all: `residence` Room types never reach public Explore,
 * and a tenant reaches one through a broker. That invariant is not a filter
 * applied here — it is held by the catalogue in `@/data/broker`, which is its
 * own array rather than a flag on the explorable one, so there is nothing on
 * this screen that could forget it. The note under the search field says the
 * same thing to the reader, because a broker who does not know the inventory is
 * private has no idea what their fee is for.
 *
 * ## The four states
 *
 * `useFixture` gives the read the shape the API read will have, so the skeleton
 * and the failure branch are exercised rather than added later. The empty state
 * is **per filter**: `unitEmptyReason` drops each active axis in turn and
 * reports the one that alone brings results back, so the screen names the
 * filter that emptied the list and offers to lift exactly that one. Offline is
 * a state, not an error (frames.md): the shell's banner says the connection is
 * gone and a note here says the list is the last one that loaded.
 *
 * ## The search is a sheet, and it is an overlay rather than a route
 *
 * The route table is frozen until Session 11 and registers no
 * `directory/search`, so the sheet is a `Modal` over the tab — the same call
 * Session 3 made for its dates sheet, and for the same reason. It edits a draft
 * and commits once, which is what makes "Clear all" safe to press and what lets
 * the footer say how many units the draft would return before the reader
 * commits to it.
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
  Text,
  useOffline,
  WorkspaceChip,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { useFixture } from '@/data/use-fixture';
import { DIRECTORY_UNITS, type DirectoryUnit } from '@/data/broker';
import {
  DEFAULT_UNIT_SEARCH,
  searchUnits,
  summariseUnitSearch,
  activeUnitFilterCount,
  unitEmptyReason,
  useUnitSearch,
  type UnitSearch,
} from '@/data/broker-search';
import { ActiveUnitChips, UnitRail, UnitSearchField, activeUnitChips } from './broker-chips';
import { DirectorySearchSheet } from './directory-search-sheet';
import { UnitCard } from './unit-card';

export function Directory() {
  const { c, space } = useTheme();
  const router = useRouter();
  const t = useT();
  const { workspace } = useDomain();

  const { search, setSearch } = useUnitSearch();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const read = useFixture('broker.directory', () => DIRECTORY_UNITS);
  const catalogue = read.data ?? [];
  const results = useMemo(() => searchUnits(search, catalogue), [search, catalogue]);

  // The rail's counts are of the whole catalogue, not of the current results:
  // a chip that said "Vacant now · 0" because the reader had already filtered
  // them out would be a chip that punishes them for using it.
  const counts = useMemo(
    () => ({
      now: catalogue.filter((u) => u.vacancy.state === 'now').length,
      soon: catalogue.filter((u) => u.vacancy.state !== 'leased').length,
    }),
    [catalogue],
  );

  const offline = useOffline();

  const summary = summariseUnitSearch(search, t);
  const untouched = summary === t('directory.searchPlaceholder');
  const chips = activeUnitChips(search, t);

  return (
    <>
      <Screen.List<DirectoryUnit>
        greeting={t('directory.greeting')}
        title={t('directory.title')}
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

            <UnitSearchField
              summary={summary}
              filled={!untouched}
              filterCount={activeUnitFilterCount(search)}
              onPress={() => setFiltersOpen(true)}
            />

            <UnitRail
              search={search}
              // No counts until the catalogue is read: `Screen.List` draws
              // this header while the read is in flight, and the counts of an
              // empty `read.data ?? []` printed "Vacant now · 0" (mobile audit
              // 2026-10-05, BR-06; the device rig's finding).
              counts={read.data ? counts : undefined}
              onChange={setSearch}
              onOpenFilters={() => setFiltersOpen(true)}
            />

            <ActiveUnitChips chips={chips} onChange={setSearch} />

            <PrivateNote />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: space[2],
              }}
            >
              <SectionLabel>{t('directory.sectionUnits')}</SectionLabel>
              {read.data ? (
                <Text size="xs" color="textMuted">
                  {results.length === 1
                    ? t('directory.resultsOne')
                    : t('directory.resultsCount', { count: results.length })}
                </Text>
              ) : null}
            </View>
          </>
        }
        data={results}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => (
          <UnitCard
            unit={item}
            onPress={() =>
              router.push({ pathname: '/directory/[unitId]', params: { unitId: item.id } })
            }
          />
        )}
        loading={read.status === 'loading'}
        loadingLabel={t('state.loadingList', { label: t('directory.listLabel') })}
        loadingRows={3}
        empty={
          read.status === 'error' ? (
            <ErrorState
              title={t('state.errorTitle')}
              body={t('state.errorBody', { label: t('directory.listLabel') })}
              detail={read.error?.message}
              onRetry={read.retry}
            />
          ) : (
            <NoUnits search={search} catalogue={catalogue} onChange={setSearch} />
          )
        }
      />

      <DirectorySearchSheet
        open={filtersOpen}
        value={search}
        catalogue={catalogue}
        onClose={() => setFiltersOpen(false)}
        onCommit={(next) => {
          setSearch(next);
          setFiltersOpen(false);
        }}
      />
    </>
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

  /**
   * The invariant, said out loud. F-R01 is the whole basis of the broker
   * channel and it is invisible on a screen that just lists flats.
   */
  function PrivateNote() {
    return (
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={t('directory.privateNote')}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space[2],
          paddingVertical: 2,
        }}
      >
        <Icon name="lock" size={14} color={c.textSubtle} />
        <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
          {t('directory.privateNote')}
        </Text>
      </View>
    );
  }
}

/**
 * The empty state, in the three flavours it actually has. They are three
 * different facts and a single "nothing found" would be a lie in two of them.
 */
function NoUnits({
  search,
  catalogue,
  onChange,
}: {
  search: UnitSearch;
  catalogue: readonly DirectoryUnit[];
  onChange: (next: UnitSearch) => void;
}) {
  const t = useT();
  const reason = unitEmptyReason(search, catalogue);

  // One filter is responsible, and it can be named and lifted on its own.
  if (reason) {
    const filter = t(reason.label);
    return (
      <EmptyState
        icon="filter"
        title={t('directory.emptyFilterTitle', { filter })}
        body={t('directory.emptyFilterBody')}
        action={
          <Button variant="outline" size="md" onPress={() => onChange(reason.clear(search))}>
            {t('directory.emptyFilterAction', { filter })}
          </Button>
        }
      />
    );
  }

  // Filters are set but no single one explains it: it is the combination.
  if (activeUnitFilterCount(search) > 0) {
    return (
      <EmptyState
        icon="filter"
        title={t('directory.emptyAllTitle')}
        body={t('directory.emptyAllBody')}
        action={
          <Button variant="outline" size="md" onPress={() => onChange(DEFAULT_UNIT_SEARCH)}>
            {t('directory.emptyAllAction')}
          </Button>
        }
      />
    );
  }

  // Nothing is filtered, so the directory itself is empty.
  return (
    <EmptyState
      icon="building"
      title={t('directory.emptyTitle')}
      body={t('directory.emptyBody')}
      action={
        <Button variant="outline" size="md" onPress={() => onChange(DEFAULT_UNIT_SEARCH)}>
          {t('directory.emptyAction')}
        </Button>
      }
    />
  );
}
