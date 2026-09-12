"use client";

import { AirtelMark, MtnMark } from "@/components/icons/marks";
import { CheckoutFieldGroup, CheckoutField } from "@/components/book/checkout-field";
import {
  groupHandset,
  paymentMethod,
  validateMobileNumber,
  type PaymentMethodId,
} from "@/lib/payment-methods";

const MARK: Record<"mtn_momo" | "airtel_money", typeof MtnMark> = {
  mtn_momo: MtnMark,
  airtel_money: AirtelMark,
};

/**
 * The phone entry for MTN MoMo or Airtel Money.
 *
 * One component for both rails rather than two near-identical ones: they
 * differ only in their mark, their label and which prefixes are theirs, and
 * `payment-methods.ts` already carries all three.
 *
 * Confirming here does not charge anything. `PaymentPort` has no operation
 * that pushes a USSD prompt yet (F-S08 lists it as still owed), so this
 * collects the number the booking will be charged to and nothing more —
 * exactly as far as the seam reaches today.
 */
export function PaymentMobileMoneyForm({
  method,
  phone,
  onChange,
  showError = false,
}: {
  method: "mtn_momo" | "airtel_money";
  phone: string;
  onChange: (phone: string) => void;
  showError?: boolean;
}) {
  const meta = paymentMethod(method);
  const Mark = MARK[method];
  const problem = showError ? validateMobileNumber(method, phone) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm text-page-fg-70">
        <Mark width={22} height={22} aria-hidden />
        You will be sent a payment prompt on {meta.label} to approve on your
        handset.
      </p>

      <CheckoutFieldGroup>
        {/*
          Grouped as it is typed, and the caret is held where the guest left it.
          `groupHandset` works on a PARTIAL number so the field settles into
          `078 812 3456` while they type rather than snapping at the ninth
          digit, and `reformats` is what stops the cursor jumping to the end
          when they go back to correct one.
        */}
        <CheckoutField
          label="Mobile number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="078 812 3456"
          reformats
          value={groupHandset(phone)}
          onChange={onChange}
          error={problem}
        />
      </CheckoutFieldGroup>
    </div>
  );
}
