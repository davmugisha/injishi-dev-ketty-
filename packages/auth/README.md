# @injishi/auth

**This is the source.** It used to be a build-output mirror of
`injishi.managed/packages/auth`; that repo was deleted in September 2026 and
this directory is the only copy. There is no sync script and nothing to sync
from. See ADR-034 in the corpus (`injishi.context/dox/adrs/034-vendor-becomes-source.md`).

Ships only compiled `dist/` (JS + `.d.ts`). The TypeScript source was lost with the repo. Reconstructing it is owed under ADR-034; until then `dist/` is the source.

The directory was called `vendor/` until ADR-034 task 7 renamed it. A directory
called `vendor` is a directory nobody edits, which was the wrong instruction to
leave on the only copy of a shared package.
