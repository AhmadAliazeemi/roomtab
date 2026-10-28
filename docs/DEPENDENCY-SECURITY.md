# Dependency security notes

This repository uses two explicit npm overrides to avoid currently reported transitive dependency vulnerabilities without applying npm's breaking `--force` downgrade.

## `@grpc/grpc-js`

The Firebase JS SDK version in use pulls `@grpc/grpc-js@1.9.16` through Firestore's Node dependency path. That release is in the affected range for [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) and [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4). The override pins the patched `1.13.7` release. Firebase's Firestore package has historically declared the `~1.9.0` range, so this override intentionally moves beyond that narrow minor range while staying on the gRPC JS v1 major. CI builds and the application should be smoke-tested when Firebase or gRPC versions change.

## Vendored `deepmerge` security backport

The Workbox build chain pulls `deepmerge`. The [GHSA-gcqx-w48m-w2h4 advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) reports a prototype-poisoning guard bypass in published `deepmerge` versions through 4.3.1, and currently lists no official patched npm release. The fix in this repository is a small local backport based on the proposed upstream change in [deepmerge PR #274](https://github.com/TehShrike/deepmerge/pull/274): drop `__proto__` keys in both the target-copy and source-copy loops. The local package is labeled 4.3.2 solely to distinguish this patched private copy from upstream 4.3.1; it is **not** an upstream-published release.

Regression tests cover a null-prototype target, nested null placeholder, own `__proto__` key, and array elements. Run them with `npm run test:security`.

When upstream publishes an official patched `deepmerge` release and the advisory is updated, remove the local vendor directory and its override, then use the official fixed release instead.
