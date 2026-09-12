/**
 * Phone redaction (F-S06, ADR-032 AC-18).
 *
 * The two claims worth asserting are the two the ADR makes, and they pull in
 * opposite directions:
 *
 *   - **The stored body is never altered.** Every character of the input comes
 *     back out in the segments, in order, so a screen cannot lose text by
 *     mishandling the result — it can only reveal or hide it. That is the
 *     property that makes redacting on READ safe next to an append-only,
 *     never-rewritten `messages` table.
 *   - **The numbers people actually type are caught**, in every separator style
 *     the ADR names, in both the local and the international form.
 *
 * The false-positive case is asserted too, and asserted as CORRECT. The ADR is
 * explicit that this is a heuristic and that over-hiding is the right direction
 * to fail in, so a test that demanded a long reference number survive would be
 * a test arguing against the decision.
 */
import { hasPhone, scrubPhones, scrubbedText } from './scrub';

const HIDDEN = '[hidden]';

/** What the reader is left with. */
const shown = (body: string) => scrubbedText(body, HIDDEN);

/** The runs the function decided to hide. */
const hidden = (body: string) =>
  scrubPhones(body)
    .filter((s) => s.kind === 'redacted')
    .map((s) => s.value);

describe('the segments', () => {
  it('reconstruct the input exactly, so no text can be lost', () => {
    const bodies = [
      'He may call ahead — his number is +250 788 512 004 if you need to reach him.',
      'no numbers here at all',
      '0788431209',
      '',
      'two of them: 0788431209 and +250 788 512 004.',
    ];

    for (const body of bodies) {
      expect(
        scrubPhones(body)
          .map((s) => s.value)
          .join(''),
      ).toBe(body);
    }
  });

  it('leaves a body with no number as a single text segment', () => {
    expect(scrubPhones('The electrician is booked for Friday morning.')).toEqual([
      { kind: 'text', value: 'The electrician is booked for Friday morning.' },
    ]);
  });
});

describe('what it hides', () => {
  it('catches the international form in every separator style the ADR names', () => {
    expect(hidden('call +250 788 512 004 today')).toEqual(['+250 788 512 004']);
    expect(hidden('call +250788512004 today')).toEqual(['+250788512004']);
    expect(hidden('call +250-788-512-004 today')).toEqual(['+250-788-512-004']);
    expect(hidden('call +250.788.512.004 today')).toEqual(['+250.788.512.004']);
    expect(hidden('call 00250 788 512 004 today')).toEqual(['00250 788 512 004']);
  });

  it('catches the local form people type into a phone', () => {
    expect(hidden('ring 0788 431 209 after six')).toEqual(['0788 431 209']);
    expect(hidden('ring 0788431209 after six')).toEqual(['0788431209']);
    expect(hidden('ring 078-843-1209 after six')).toEqual(['078-843-1209']);
  });

  it('catches a bare run of digits long enough to be a number', () => {
    expect(hidden('reach me on 7885120')).toEqual(['7885120']);
  });

  it('reads a body with a number as having one, without splitting it', () => {
    expect(hasPhone('his number is +250 788 512 004')).toBe(true);
    expect(hasPhone('the keypad code is in your arrival guide')).toBe(false);
  });
});

describe('what it leaves alone', () => {
  it('keeps the short numbers a conversation is full of', () => {
    // Times, room numbers, access codes, prices, dates, speeds. None of these
    // is long enough to be a phone number and none may be hidden, or the
    // redaction would eat the useful half of every message.
    const body =
      'Between 08:00 and 10:00, room 4, code 4821, RWF 310,000, on 14 Jul, fibre is 100 Mbps.';
    expect(hidden(body)).toEqual([]);
    expect(shown(body)).toBe(body);
  });

  it('does not treat a booking reference as a number', () => {
    expect(hidden('Reference INJ-4703-AK')).toEqual([]);
  });
});

describe('the heuristic, failing in the direction the ADR chose', () => {
  /**
   * A seven-digit reference IS hidden. That is a false positive and it is the
   * documented trade: over-hiding costs a reader one lookup, under-hiding
   * leaks a phone number and breaks F-S06. The ADR's follow-up asks for a
   * pinned fixture of real examples before the pattern is trusted; this test
   * is what will fail loudly when that pattern is tightened, which is the
   * point of writing it down rather than leaving it implied.
   */
  it('hides a long reference number too, which is the accepted cost', () => {
    expect(hidden('the docket is 4821903')).toEqual(['4821903']);
  });
});

describe('scrubbedText', () => {
  it('substitutes the caller-supplied placeholder, not a baked-in string', () => {
    expect(shown('his number is +250 788 512 004 ok')).toBe(`his number is ${HIDDEN} ok`);
    expect(scrubbedText('his number is +250 788 512 004 ok', 'nimero yahishwe')).toBe(
      'his number is nimero yahishwe ok',
    );
  });
});
