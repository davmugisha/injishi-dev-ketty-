# Third party notices

This file names outside work that shaped Injishi, and says how each one was
used. It is about credit and licence duties; the libraries the code installs
are listed in each workspace member's `package.json` and in `pnpm-lock.yaml`.

## Horilla HRMS: a design reference, no code

The HR module (`server/api/src/modules/people`, the Staff screens in
`apps/app`, and the HR schemas in `packages/contracts`) is modelled on the
design of **Horilla HRMS** (`horilla/horilla-hr`, licensed under the GNU Lesser
General Public License, version 2.1). Its concepts, field lists, state machines
and rules were studied and rebuilt in Injishi's own TypeScript, under Injishi's
own tenancy, authorization, audit and interface conventions.

**No Horilla code is included in this repository.** No Python, SQL, HTML, CSS,
JavaScript, template markup, user interface text or translation was copied from
Horilla, in any form, translated or not. Where a rule was borrowed, the record
that decided it names the Horilla model it came from, so the trail can be
followed: ADR-058 in the documentation corpus, and its child ADRs.

Horilla is the work of its own authors. See the Horilla repository for its
licence text and copyright notices.
