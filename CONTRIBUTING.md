# Contributing to Injishi

How work gets to `main`. This is the short version for everyone on the team. The
decision behind each rule, and why, is ADR-078 in `injishi.context`
(`dox/adrs/078-delivery-guardrails/`).

## The rules in force

- **The merge rule is in force since:** _not yet. The owner writes the date here
  once `main` passes `injishi/ci-complete`._
- **`injishi/integration` is required since:** _not yet. The owner writes the
  date here the first day `main` passes it._

Until the first date is written, only pull requests that make `main` pass
`injishi/ci-complete` merge.

## How work enters

1. **Propose it.** Open an issue with the **Scope proposal** template: the
   problem, the acceptance criteria, and what is out of scope.
2. **The owner approves it.** The owner (GitHub `heissshami`) enrolls it in the
   scope in `injishi.context`, links that entry in the issue, and applies the
   `scope: approved` label. Only the owner applies that label: the rules check
   reads who applied it, so a label anyone else adds does not count.
3. **Build it.** Feature work goes `/architect` (the decisions, written as a
   spec), then `/develop` (built to that spec), then `/check verify` (proven on
   the running app).
4. **Open a pull request** from a branch of your fork into `main`, and only
   `main`. Fill in the template.

A fix or a chore needs no scope item, unless it adds or deletes a page, route,
screen, controller, module, product view or workspace member. That always needs
an approved scope item, whatever the type.

## What a pull request carries

The template lists these as `Name:` lines. Fill in what your change needs.

| Type | Lines it needs |
| --- | --- |
| `feature` | `Scope:` (`#N`, an approved issue), `Spec:` (the ADR or spec), `Verify:` (what `/check verify` ran and found) |
| `fix` | `Broken:` (what was wrong), `Reproduced:` (how you made it happen), `Proof:` (what shows it works now) |
| `chore` | nothing more |

And, whatever the type:

| When the change | It also needs |
| --- | --- |
| deletes a page, route, screen, controller, module, product view or member | `Removes:` (what and why) and an approved `Scope:` |
| adds one of those | an approved `Scope:` |
| raises a row in the lint, cycles or knip baseline | `Baseline:` (why) |
| touches `Jenkinsfile`, `jenkins/`, `scripts/`, `.github/`, `tools/`, a lint, knip or vitest config, or a `package.json` `scripts` block | `Pipeline:` (why) |

Moving a file is not deleting it. A value of `n/a`, `none`, `tbd` or `-` counts
as empty.

## The merge rule

A pull request merges only when its head commit shows these as green:

| Status | Comes from | Means |
| --- | --- | --- |
| `injishi/ci-complete` | the Jenkins build | every CI job passed, or had nothing to check |
| `injishi/pr-rules` | the rules job, every 5 minutes | the lines above are there, the base is `main`, the scope issue is approved |
| `injishi/review` | the rules job, every 5 minutes | someone other than the author approved this exact commit |

And `injishi/integration` too, once its date above is written. Then the owner
merges it, as a squash. **This binds the owner's own pull requests too.**

- Pushing a new commit returns `injishi/review` to waiting: ask for approval
  again.
- Editing the description starts no build. `injishi/pr-rules` reads it again
  within 5 minutes.
- `continuous-integration/jenkins/pr-merge` is Jenkins' own summary of the whole
  build, red whenever integration fails. The rule does not read it.

## When it is an emergency

When production is broken, or CI itself is down, put both lines in the
description:

```
Emergency: <what is broken>
Follow-up: #<an open issue for putting it right>
```

`injishi/pr-rules` passes it, and the owner may merge it without a green
`injishi/ci-complete` or an approval. The follow up pull request brings `main`
back to green within one working day. An emergency never makes a pull request
into another branch acceptable.

## What merging does

The repository squashes every pull request into one commit on `main`, whose
message is the pull request's title and description, and deletes the branch
afterwards. Keep the description true: it becomes the history.

## Checks you can run yourself

```bash
# What injishi/pr-rules will say about your pull request, without posting it
GITHUB_TOKEN="$(gh auth token)" node scripts/check-pr-rules.mjs --dry-run --pr <number>

# The rules' own tests
node --test scripts/check-pr-rules.test.mjs

# Dead code per member against .github/knip-baseline.json. CI's count is the one
# that counts: a laptop without the HeroUI Pro token, or on Windows, may differ.
pnpm dead-code:ratchet

# Lint warnings per member, and every member's scripts
pnpm lint:ratchet
pnpm check:manifests
```
