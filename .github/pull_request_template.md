<!--
  The injishi/pr-rules check reads the lines below every 5 minutes (ADR-078,
  CONTRIBUTING.md). Fill in what your type needs and leave the rest empty.
  Comments like this one are ignored, so a line that still only holds its
  comment counts as empty.
-->

Type: <!-- feature, fix or chore -->

<!-- A feature needs all three. -->
Scope: <!-- #N: an issue the owner labelled "scope: approved" -->
Spec: <!-- ADR-0NN, or the spec's path -->
Verify: <!-- what /check verify ran and found, or a link to its report -->

<!-- A fix needs all three. -->
Broken: <!-- what was wrong, as someone would have seen it -->
Reproduced: <!-- how you made it happen before the fix -->
Proof: <!-- what shows it works now: a test, a command, a screenshot -->

<!-- Any type, only when it applies. -->
Removes: <!-- you delete a page, route, screen, controller, module, product view or workspace member: what, and why. Needs an approved Scope too. -->
Baseline: <!-- you raise a row in the lint, cycles or knip baseline: why -->
Pipeline: <!-- you change Jenkinsfile, jenkins/, scripts/, .github/, tools/, a lint, knip or vitest config, or a package.json scripts block: why -->

## What changed and why

<!-- In plain words, for the person approving it. -->
