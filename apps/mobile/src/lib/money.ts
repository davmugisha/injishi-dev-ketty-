// Rwandan francs as the prototype writes them (`rwf()` in its lib.mjs): "RWF 186,000". Whole francs,
// grouped by commas whatever the phone's locale, so a receipt reads the same on every phone.
// Pure: no React Native import, so `node --test` reads it.

/** `rwf(186000)` is "RWF 186,000"; `rwf(-5000)` is "RWF -5,000". Fractions round to the franc. */
export function rwf(amount: number): string {
  const whole = Math.round(Math.abs(amount));
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `RWF ${amount < 0 && whole !== 0 ? "-" : ""}${grouped}`;
}
