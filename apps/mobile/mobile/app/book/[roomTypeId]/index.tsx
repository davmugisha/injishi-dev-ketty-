/**
 * The booking stepper — dates, guests, summary, pay. F-B05, FL07, Guest canvas
 * artboards 5, 6 and 7.
 *
 * On the ROOM TYPE rather than the property, because the Room type is what owns
 * price, availability, booking mode and cancellation tier (ui-glossary.md,
 * F-B03). The property is looked up from the room.
 *
 * The params are the Property detail page's CTA handing over what the guest has
 * already chosen, so the stepper never asks a second time for dates they set on
 * the page behind it. They seed the draft once; after that the draft owns them.
 */
import { useLocalSearchParams } from 'expo-router';
import { BookStepperScreen } from '@/screens/guest/book-stepper';

export default function BookScreen() {
  const { roomTypeId, checkIn, checkOut, nonRefundable } = useLocalSearchParams<{
    roomTypeId: string;
    checkIn?: string;
    checkOut?: string;
    nonRefundable?: string;
  }>();

  return (
    <BookStepperScreen
      roomTypeId={roomTypeId}
      checkIn={checkIn}
      checkOut={checkOut}
      nonRefundable={nonRefundable}
    />
  );
}
