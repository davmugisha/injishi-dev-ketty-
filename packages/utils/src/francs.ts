/**
 * A typed amount of Rwandan francs. Francs have no minor unit, so an amount is a whole number: digits,
 * optionally grouped in threes by commas, spaces or apostrophes ("20,000", "20 000"), with dots taken
 * as thousands only where they cannot be a decimal point ("1.250.000"). A decimal part ("20,000.50",
 * "20000,5") is refused with a reason, never folded into the digits: stripping every non-digit took
 * "20,000.50" as 2,000,050. Nothing typed is ever multiplied or rounded into another amount.
 */
interface TypedFrancs {
  /** The whole francs typed; 0 when the field is empty or refused. */
  amount: number;
  /** Why the text is not an amount, said to the person; null when it is one (or the field is empty). */
  error: string | null;
}

/** No-break, narrow no-break and thin spaces: what a phone keyboard or a pasted amount may carry. */
const ODD_SPACES = new RegExp(`[${String.fromCharCode(0xa0, 0x202f, 0x2009)}]`, "g");
const SEPARATORS = /[,. ']/;
/** The largest amount a desk field takes: well past any bill, and exact as a JavaScript number. */
const MAX_DIGITS = 12;

export function readFrancs(text: string): TypedFrancs {
  const t = text
    .trim()
    .replace(/^(rwf|frw)\.?\s*/i, "")
    .replace(/\s*(rwf|frw)\.?$/i, "")
    .replace(ODD_SPACES, " ")
    .trim();
  if (!t) return { amount: 0, error: null };
  const refuse = (error: string): TypedFrancs => ({ amount: 0, error });
  if (/[^\d,. ']/.test(t)) return refuse("Type the amount in digits, in whole francs (for example 20,000).");
  if (!/^\d/.test(t) || !/\d$/.test(t))
    return refuse("Type the amount in digits, in whole francs (for example 20,000).");

  const groups = t.split(SEPARATORS);
  const seps = t.match(new RegExp(SEPARATORS.source, "g")) ?? [];
  if (seps.length === 0) return whole(t);
  if (groups.some((g) => g === "")) return refuse("Type the amount in digits, in whole francs (for example 20,000).");

  const last = seps[seps.length - 1];
  const tail = groups[groups.length - 1];
  // A comma or dot before one or two digits is a decimal point: francs have none.
  if ((last === "," || last === ".") && tail.length < 3) {
    return refuse(`Francs have no decimal part. Type whole francs, without “${last}${tail}”.`);
  }
  // Two kinds of mark, one of them a dot or comma ("20.000,00", "1,234.567"): which is the decimal
  // point cannot be told, so it is not guessed.
  if (new Set(seps).size > 1) {
    return refuse("Use one kind of separator for thousands (20,000 or 20 000), and no decimal part.");
  }
  // One dot followed by three digits ("20.000") is twenty thousand in one habit and twenty in another.
  if (last === "." && seps.length === 1) {
    return refuse(`“${t}” could be read two ways. Type it as ${groups.join("")} or with commas.`);
  }
  if (groups[0].length > 3 || groups.slice(1).some((g) => g.length !== 3)) {
    return refuse("Group thousands in threes (20,000), or type digits only.");
  }
  return whole(groups.join(""));
}

function whole(digits: string): TypedFrancs {
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  if (trimmed.length > MAX_DIGITS) return { amount: 0, error: "That amount is too large for one entry." };
  return { amount: Number(trimmed), error: null };
}

/** The whole francs typed ("12,000" → 12000); 0 when the text is empty or not an amount (see readFrancs). */
export function parseAmount(text: string): number {
  return readFrancs(text).amount;
}
