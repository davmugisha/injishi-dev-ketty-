/**
 * Organisation profile — frame R5's "Organisation profile ›".
 *
 * A card screen rather than a sheet: it holds the facts a landlord's whole
 * compliance position rests on, and half of them are what an RRA filing quotes.
 * That is reading, not glancing.
 *
 * **The TIN is the reason this screen exists**, and it is why the verified date
 * is printed rather than just a tick. `architecture-schema.md`'s decisions put
 * the taxpayer number on the Org, F-P13 files against it, and R10's filing
 * screen quotes it back — so a landlord who cannot see when it was last checked
 * has no way to know whether a rejected filing is their problem or the
 * platform's.
 *
 * The name is read off the active workspace rather than off the fixture,
 * because the seat is what says which building this is: Session 8's D7a
 * amendment turned on exactly that, and every landlord screen already reads its
 * org from `useDomain().workspace.name`.
 */
import { View } from 'react-native';
import { BackHeader, Button, Card, Screen, StatRow, Text, useToast } from '@/components';
import { useTheme } from '@/theme/theme';
import { useDomain } from '@/domain';
import { useT } from '@/i18n/i18n';
import { ORGANISATION } from './account-fixtures';
import { formatLongDay } from './account-format';

export function OrganisationScreen() {
  const { space } = useTheme();
  const t = useT();
  const toast = useToast();
  const { workspace } = useDomain();
  const org = ORGANISATION;

  return (
    <>
      <BackHeader />
      <Screen title={t('org.title')} greeting={workspace.name}>
        {/* No "TIN verified" badge: it was drawn over a fixture TIN with
            nothing checked behind it (mobile audit 2026-10-05, SA-02, SA-03).
            The real claim is the org's `registrationStatus`, which the read
            that replaces this fixture will carry. */}
        <Card title={t('org.identityTitle')} subtitle={t('org.identityBody')}>
          <View>
            <StatRow label={t('org.legalName')} value={org.legalName} divider />
            <StatRow label={t('org.tradingName')} value={workspace.name} divider />
            <StatRow label={t('org.tin')} value={org.tin} divider />
            <StatRow label={t('org.tinChecked')} value={formatLongDay(org.tinVerifiedOn, t)} divider />
            <StatRow label={t('org.regime')} value={t(`org.regime.${org.regime}` as const)} />
          </View>
        </Card>

        <Card title={t('org.whereTitle')} subtitle={t('org.whereBody')}>
          <View>
            <StatRow label={t('org.district')} value={org.district} divider />
            <StatRow label={t('org.sector')} value={org.sector} />
          </View>
        </Card>

        <Card title={t('org.contactTitle')} subtitle={t('org.contactBody')}>
          <View>
            <StatRow label={t('org.phone')} value={org.contactPhone} divider />
            <StatRow label={t('org.email')} value={org.contactEmail} />
          </View>
        </Card>

        {/* The consequence, printed rather than discovered. An org's legal
            details are what a filing and a lease both quote, so changing them
            is not a settings edit — it is a re-verification. */}
        <View style={{ gap: space[2] }}>
          <Button
            variant="outline"
            size="lg"
            block
            leadingIcon="externalLink"
            onPress={() => toast.show(t('org.editToast'), 'neutral')}
            accessibilityHint={t('org.editHint')}
          >
            {t('org.edit')}
          </Button>
          <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
            {t('org.editNote')}
          </Text>
        </View>
      </Screen>
    </>
  );
}
