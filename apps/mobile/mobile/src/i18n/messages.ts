/**
 * The message catalogue — a stand-in for Paraglide (F-A20), which is
 * `[planned]` and not installed.
 *
 * code-standards.md is explicit that no display string may be hardcoded and
 * that every one carries an EN and an RW key. Paraglide compiles that catalogue
 * into `src/paraglide`; until it lands, this file is the catalogue and `t()` is
 * the accessor. The shape is deliberately the shape Paraglide will replace —
 * flat dotted keys, positional `{name}` placeholders — so the migration is a
 * codemod on the import, not a rewrite of every call site.
 *
 * **One file per namespace, merged here.** Session 0 split what used to be one
 * 775-line file into `./messages/<namespace>.ts`, because thirteen parallel
 * sessions all appending to the bottom of one catalogue is thirteen conflicts
 * in the same hunk. Each namespace file is owned by the session that builds its
 * screens, so a session edits one file nobody else touches. The merge order
 * below is alphabetical apart from `common`, which goes first because it is
 * what everything else reads and a reader looking for a nav label should find
 * it at the top.
 *
 * **Two levels of parity, both type errors.** Each namespace file types its own
 * `rw` as `Record<keyof typeof en, string>`, so a key added to one column and
 * not the other fails `tsc` *in that file*, next to the change. This file types
 * the merged `rw` the same way, which catches a namespace wired into one merge
 * and not the other. Neither is a review note; both fail the build.
 *
 * A key collision between two namespaces is silent — the later spread wins — so
 * every namespace prefixes its keys with its own name. `common` is the one that
 * carries several prefixes (`nav`, `a11y`, `state`, `status`, …), because those
 * are the shell's and the shared kit's, and no screen namespace may define one.
 *
 * The RW text is a working translation for layout purposes, not a reviewed one:
 * ui-rules.md warns that RW runs longer than EN and that nothing may truncate,
 * so the value of having it here now is that switching language stresses the
 * layout. Have a Kinyarwanda speaker pass over it before it ships. A string
 * ending in ` (RW)` is one no session had Kinyarwanda for, and is the audit's
 * work list.
 */
import * as common from './messages/common';
import * as account from './messages/account';
import * as auth from './messages/auth';
import * as book from './messages/book';
import * as broker from './messages/broker';
import * as checkin from './messages/checkin';
import * as guest from './messages/guest';
import * as host from './messages/host';
import * as inbox from './messages/inbox';
import * as landlord from './messages/landlord';
import * as oversight from './messages/oversight';
import * as pay from './messages/pay';
import * as saved from './messages/saved';
import * as search from './messages/search';
import * as tenant from './messages/tenant';
import * as work from './messages/work';

export const en = {
  ...common.en,
  ...account.en,
  ...auth.en,
  ...book.en,
  ...broker.en,
  ...checkin.en,
  ...guest.en,
  ...host.en,
  ...inbox.en,
  ...landlord.en,
  ...oversight.en,
  ...pay.en,
  ...saved.en,
  ...search.en,
  ...tenant.en,
  ...work.en,
};

export type MessageKey = keyof typeof en;

export const rw: Record<MessageKey, string> = {
  ...common.rw,
  ...account.rw,
  ...auth.rw,
  ...book.rw,
  ...broker.rw,
  ...checkin.rw,
  ...guest.rw,
  ...host.rw,
  ...inbox.rw,
  ...landlord.rw,
  ...oversight.rw,
  ...pay.rw,
  ...saved.rw,
  ...search.rw,
  ...tenant.rw,
  ...work.rw,
};

export type Locale = 'en' | 'rw';

export const catalogues: Record<Locale, Record<MessageKey, string>> = { en, rw };

export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'rw', label: 'Kinyarwanda' },
];
