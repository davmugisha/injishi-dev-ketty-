/**
 * Step 3 of 3 — confirm and pay. Guest canvas artboard 7, `bookPay` in
 * `screens-b.mjs`.
 *
 * **MTN MoMo first, then Airtel Money, then card.** That order is in the canvas
 * twice — here and on frame R12's rent sheet — and it is not alphabetical. It
 * is how Rwanda pays. A checkout that opened with Visa would be an app built
 * for somebody else's market, so the order is data (`PAY_METHODS`) rather than
 * markup, and the card is last.
 *
 * **The fields validate as you type, and every message says what to do.** The
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
 * offers to remember a card, and the escrow note says so in as many words.
 */
import { View } from 'react-native';
import type { MoneyBreakdown } from '@injishi/contracts';
import { Card, InputField, SectionLabel } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { RoomCard } from '@/data/property-detail';
import {
  PAY_METHODS,
  checkCardNumber,
  checkCvv,
  checkExpiry,
  checkHandset,
  groupCard,
  groupExpiry,
  groupHandset,
  type PayMethod,
} from './book-format';
import { AdapterChip, Choice, MoneyRow, Note } from './book-parts';

export interface StepPayProps {
  room: RoomCard;
  money: MoneyBreakdown;
  method: PayMethod;
  handset: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  onMethod: (method: PayMethod) => void;
  onHandset: (value: string) => void;
  onCardNumber: (value: string) => void;
  onCardExpiry: (value: string) => void;
  onCardCvv: (value: string) => void;
}

export function BookStepPay({
  room,
  money,
  method,
  handset,
  cardNumber,
  cardExpiry,
  cardCvv,
  onMethod,
  onHandset,
  onCardNumber,
  onCardExpiry,
  onCardCvv,
}: StepPayProps) {
  const { space } = useTheme();
  const t = useT();

  const phone = checkHandset(handset, method, t);
  const number = checkCardNumber(cardNumber, t);
  const expiry = checkExpiry(cardExpiry, t);
  const cvv = checkCvv(cardCvv, t);

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
              onPress={() => onMethod(spec.id)}
              testID={`book-method-${spec.id}`}
            >
              {/* The fields live INSIDE the chosen row rather than below the
                  group, so the number and the method it belongs to are never
                  separated by a row the guest did not pick. */}
              {spec.prefixes ? (
                <InputField
                  label={t('book.mobileNumber')}
                  value={groupHandset(handset)}
                  onChangeText={onHandset}
                  placeholder={t('book.mobilePlaceholder')}
                  prefix="+250"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  maxLength={11}
                  helper={phone.tone === 'hint' ? (phone.text ?? undefined) : undefined}
                  error={phone.tone === 'error' ? (phone.text ?? undefined) : undefined}
                  testID={`book-handset-${spec.id}`}
                />
              ) : (
                <View style={{ gap: 12 }}>
                  <InputField
                    label={t('book.cardNumber')}
                    value={groupCard(cardNumber)}
                    onChangeText={onCardNumber}
                    placeholder={t('book.cardNumberPlaceholder')}
                    keyboardType="number-pad"
                    autoComplete="cc-number"
                    maxLength={23}
                    error={number.tone === 'error' ? (number.text ?? undefined) : undefined}
                    testID="book-card-number"
                  />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label={t('book.cardExpiry')}
                        value={groupExpiry(cardExpiry)}
                        onChangeText={onCardExpiry}
                        placeholder={t('book.cardExpiryPlaceholder')}
                        keyboardType="number-pad"
                        maxLength={7}
                        error={expiry.tone === 'error' ? (expiry.text ?? undefined) : undefined}
                        testID="book-card-expiry"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <InputField
                        label={t('book.cardCvv')}
                        value={cardCvv}
                        onChangeText={onCardCvv}
                        placeholder={t('book.cardCvvPlaceholder')}
                        keyboardType="number-pad"
                        maxLength={4}
                        error={cvv.tone === 'error' ? (cvv.text ?? undefined) : undefined}
                        testID="book-card-cvv"
                      />
                    </View>
                  </View>
                </View>
              )}
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
