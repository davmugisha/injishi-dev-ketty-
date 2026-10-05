/**
 * Step 3 of 3 — confirm and pay. Guest canvas artboard 7, `bookPay` in
 * `screens-b.mjs`.
 *
 * **MTN MoMo first, then Airtel Money.** That order is in the canvas twice —
 * here and on frame R12's rent sheet — and it is not alphabetical. It is how
 * Rwanda pays, so the order is data (`PAY_METHODS`) rather than markup.
 *
 * **No card fields, ever, and no card row until there is a gateway.** The
 * canvas drew a card row with number, expiry and security code fields. The
 * fields are gone for good by the owner's decision of 2026-10-01: a card is
 * typed into the payment gateway's own secure page, so the app never sees or
 * keeps it (`book-format.ts` explains). The row itself returns when the gateway
 * lands; today the API refuses a card, and a row offered then refused would be
 * worse than no row.
 *
 * **The field validates as you type, and every message says what to do.** The
 * canvas's four handset notes are the most carefully written strings on the
 * artboard: nine digits with an example, the prefix rule when the number is on
 * no network, "that is an Airtel Money number, pick Airtel Money above" when it
 * is on the other one, and the confirmation of exactly which handset the prompt
 * will reach. A field that says only "invalid" makes the guest guess; each of
 * these names the fix. `checkHandset` in `./book-format` owns all four.
 *
 * **An untouched field is never red.** `FieldNote.tone` distinguishes "not yet
 * valid" from "wrong", because colouring an empty field on arrival is a form
 * starting an argument with someone who has done nothing.
 *
 * **No stored payment methods** (FL07 §9, F-B05 §6 out of scope). Nothing here
 * offers to remember a number, and the escrow note says so in as many words.
 *
 * **Locked while a prompt is out.** Once the payment prompt has gone to a
 * handset, changing the method or the number on screen would describe a
 * payment that is not the one in flight, so both are read-only until the rail
 * answers (mobile audit 2026-10-05, GK-13).
 */
import { View } from 'react-native';
import type { MoneyBreakdown } from '@injishi/contracts';
import { Card, InputField, SectionLabel } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { RoomCard } from '@/data/property-detail';
import { PAY_METHODS, checkHandset, groupHandset, type PayMethod } from './book-format';
import { AdapterChip, Choice, MoneyRow, Note } from './book-parts';

export interface StepPayProps {
  room: RoomCard;
  money: MoneyBreakdown;
  method: PayMethod;
  handset: string;
  /** A prompt is out with the rail. See the header. */
  locked?: boolean;
  onMethod: (method: PayMethod) => void;
  onHandset: (value: string) => void;
}

export function BookStepPay({
  room,
  money,
  method,
  handset,
  locked = false,
  onMethod,
  onHandset,
}: StepPayProps) {
  const { space } = useTheme();
  const t = useT();

  const phone = checkHandset(handset, method, t);

  const requestToBook = room.summary.bookingMode !== 'instant_book';

  return (
    <View style={{ gap: space[5] }}>
      {/* ------------------------------------------------------ the methods */}
      <View style={{ gap: space[3] }}>
        <SectionLabel>{t('book.howYouPay')}</SectionLabel>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('book.howYouPay')}
          style={{ gap: 10 }}
        >
          {PAY_METHODS.map((spec) => (
            <Choice
              key={spec.id}
              selected={method === spec.id}
              title={t(spec.label)}
              hint={t(spec.hint)}
              icon={spec.icon}
              disabled={locked}
              onPress={() => onMethod(spec.id)}
              testID={`book-method-${spec.id}`}
            >
              {/* The field lives INSIDE the chosen row rather than below the
                  group, so the number and the method it belongs to are never
                  separated by a row the guest did not pick. */}
              <InputField
                label={t('book.mobileNumber')}
                value={groupHandset(handset)}
                onChangeText={onHandset}
                placeholder={t('book.mobilePlaceholder')}
                prefix="+250"
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={11}
                editable={!locked}
                helper={phone.tone === 'hint' ? (phone.text ?? undefined) : undefined}
                error={phone.tone === 'error' ? (phone.text ?? undefined) : undefined}
                testID={`book-handset-${spec.id}`}
              />
            </Choice>
          ))}
        </View>
      </View>

      {/* -------------------------------------------------------- the escrow */}
      <Card variant="tint">
        <View style={{ gap: 10 }}>
          <MoneyRow label={t('book.escrowTitle')} value={money.grossRwf} />
          <Note icon="shield">{t('book.escrowBody')}</Note>
          {/* F-B03 and FL07 path B: a request holds the money and refunds it in
              full if the host declines or lets it expire. The guest is told
              that BEFORE they press, not on the confirmation. */}
          {requestToBook ? <Note icon="clock">{t('book.requestNote')}</Note> : null}
        </View>
      </Card>

      <AdapterChip />
    </View>
  );
}
