/**
 * DomainBadge — the two domains the whole product branches on. PRD: hospitality
 * and residence are "two distinct hues, equal weight". This app is the
 * Residence-side client.
 */
import { View } from 'react-native';
import { Text } from './text';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';

export type Domain = 'hospitality' | 'residence';

const LABELS: Record<Domain, MessageKey> = {
  hospitality: 'domain.hospitality',
  residence: 'domain.residence',
};

export function DomainBadge({
  domain = 'residence',
  label,
  solid = false,
}: {
  domain?: Domain;
  label?: string;
  solid?: boolean;
}) {
  const { c, radius } = useTheme();
  const t = useT();
  const hue = domain === 'residence' ? c.domainResidence : c.domainHospitality;
  const tint = domain === 'residence' ? c.domainResidence100 : c.domainHospitality100;
  // On a SOLID fill the ink is the fill's own paired foreground: `accent` takes
  // near-ink (5.7:1 — white measures 3.1:1 and is why ADR-025 corrected it),
  // and the Residence violet takes `bgApp`, which is near-white in light and
  // near-black in dark, so the pair holds in both schemes.
  const ink = solid
    ? domain === 'residence'
      ? c.bgApp
      : c.textOnBrand
    : domain === 'residence'
      ? c.domainResidence
      : c.textLink;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        height: 22,
        paddingLeft: 9,
        paddingRight: 10,
        borderRadius: radius.pill,
        backgroundColor: solid ? hue : tint,
      }}
    >
      <View
        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: solid ? ink : hue }}
      />
      <Text weight="semibold" size="xs" color={ink}>
        {label ?? t(LABELS[domain])}
      </Text>
    </View>
  );
}
