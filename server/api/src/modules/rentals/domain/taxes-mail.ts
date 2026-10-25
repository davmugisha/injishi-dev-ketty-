import { TAX_APP_PATHS, formatRwf, longDate } from '@injishi/contracts';

import type { RentalsMail } from './rentals-mail';

/**
 * The tax and filing emails (WP 4.4): a lease copy owed to RRA, and the
 * January reminder to declare and pay rental income tax. Pure, so a test reads
 * exactly what a landlord gets.
 */

/** A lease copy is due at RRA: five days left, then one. */
export function filingReminderMail(input: {
  appUrl: string;
  leaseId: string;
  leaseReference: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  dueOn: string;
  daysLeft: number;
}): RentalsMail {
  const left = input.daysLeft <= 1 ? 'tomorrow' : `in ${input.daysLeft} days`;
  return {
    subject: `Give RRA a copy of lease ${input.leaseReference} by ${longDate(input.dueOn)}`,
    heading: 'A lease copy is due at RRA',
    lines: [
      `The lease ${input.leaseReference} with ${input.tenantName} for unit ${input.unitLabel} at ${input.propertyName} is signed.`,
      `The law asks you to give RRA a copy within 15 days of signing. That is due ${left}, on ${longDate(input.dueOn)}.`,
      'File it on the RRA portal, then mark it filed on Injishi with the reference RRA gives you.',
    ],
    action: { label: 'Mark it filed', url: new URL(TAX_APP_PATHS.filing(input.leaseId), input.appUrl).toString() },
  };
}

/** January: declare and pay last year's rental income tax by 31 January. */
export function taxNudgeMail(input: {
  appUrl: string;
  landlordName: string;
  year: number;
  dueOn: string;
  rentRwf: number;
  taxRwf: number | null;
}): RentalsMail {
  const lines = [
    `Rental income tax for ${input.year} is declared and paid to RRA by ${longDate(input.dueOn)}.`,
    `${input.landlordName} received ${formatRwf(input.rentRwf)} in rent on Injishi and recorded in ${input.year}.`,
  ];
  if (input.taxRwf !== null) {
    lines.push(
      input.taxRwf > 0
        ? `Our estimate of the tax is ${formatRwf(input.taxRwf)}, after the 50% for upkeep and any bank loan interest you recorded.`
        : 'Our estimate of the tax is nothing to pay, but the year is still declared.',
    );
  }
  lines.push('Paying late adds charges. Once you have declared, mark it on Injishi so we stop reminding you.');
  return {
    subject: `Declare your ${input.year} rental income tax by ${longDate(input.dueOn)}`,
    heading: 'Rental income tax is due',
    lines,
    action: { label: 'See the figures', url: new URL(TAX_APP_PATHS.taxes(input.year), input.appUrl).toString() },
  };
}
