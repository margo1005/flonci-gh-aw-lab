# GH-AW-TRANSPORT-01: bounded native transport verification

Status: offline transport PASS; cloud delivery and production NOT VERIFIED.
This draft does not authorize merge, Actions enablement, another inference run, or recurrence.

## Root cause and immutable evidence

- Original run: https://github.com/margo1005/flonci-gh-aw-lab/actions/runs/42472768514
- Approved base: `a52a4e50361a73afdbc6b6dd4b287d565b81b297`.
- Coding completed once. Threat detection was cancelled; independent acceptance was NOT RUN; no feature PR exists.
- The original `scripts/verify-patch.mjs:14` rejects every `.bundle`. Replaying the original captured artifact reproduced `Bundle transport not approved: 1 !== 0` before any candidate execution.
- Native gh-aw v1.0.1 resolves to `0627fdbe4beb5f3b71aa569f8d97150b87f2111a`.
  [Bundle generator](https://github.com/github/gh-aw/blob/0627fdbe4beb5f3b71aa569f8d97150b87f2111a/actions/setup/js/generate_git_bundle.cjs#L300) creates the base-to-branch bundle.
  [Transport resolver](https://github.com/github/gh-aw/blob/0627fdbe4beb5f3b71aa569f8d97150b87f2111a/actions/setup/js/resolve_transport_paths.cjs) derives both files from the repository and branch.
  [PR publisher](https://github.com/github/gh-aw/blob/0627fdbe4beb5f3b71aa569f8d97150b87f2111a/actions/setup/js/create_pull_request.cjs#L942) consumes that transport namespace. Bundle presence is expected, not proof of compromise.

Original evidence was retained in place and 44 artifact/log/outcome files SHA256-manifested outside the repository. No logs or credentials are copied into this PR.

| Evidence | SHA256 or Git object ID |
| --- | --- |
| Captured patch | `b3bf7ee9e6be7bc9cfc39925d34de2205452828b4da4afc2b915113b033d34ea` |
| Captured bundle | `8330429d618ac1100b7c269f2983f4b2402cf5426c03eda81b326e0e637790e5` |
| Candidate commit | `44ab08274cbacd698db84dd3689ba8d174a76db8` |
| Matched full tree | `46ffb63d67d4139c018a52de733c0c0470ca7e97` |
| Matched source bytes | `52d764cda4fd59923e480cff7974669dedbc8227154a80cc52700a8db81cc924` |
| Frozen 16-case suite | `ac100cdc9a9b8c9626dfbffec4a60ccf743ceec60c4deb125a1f08cb2070b4c2` |

## Minimal integration and boundaries

`verify-patch.mjs` delegates transport validation to `transport.mjs`, then submits only the verified source bytes to the existing Docker acceptance boundary. `transport.test.mjs` adds deterministic adversarial fixtures; the existing manual QA workflow includes that suite. No dependencies are added. The fifth changed file is this review record.

Only `aw-margo1005-flonci-gh-aw-lab-heb-budget-001.patch`, its matching `.bundle`, and `agent_output.json` are delivery inputs. Both transport files are mandatory. Required inputs are snapshotted with bounded reads and file identity checks. All artifact entries must be bounded regular files/directories; symlinks and hard links are refused. Known root diagnostics and four diagnostic directories are permitted, size/depth/count bounded, and ignored as delivery inputs. Unexpected root files and any nested patch/bundle fail closed.

Limits: patch and output JSON 16 KiB each, bundle 64 KiB, diagnostic file 1 MiB, total artifact 4 MiB, 256 entries, depth 5. Bundle v2 requires exactly one approved-base prerequisite and one `refs/heads/heb-budget-001` head. Pack v2 permits at most 16 objects, 64 KiB per decompressed object/delta source/delta target, 256 KiB aggregate target bytes. This narrow profile supports commit/tree/blob and REF_DELTA objects; tags, OFS_DELTA and other formats are deliberately rejected, with no fallback.

Before Git parses the untrusted pack, its checksum, compression boundaries and decompression limits are checked. Git runs with a minimal environment, no inherited credentials/config/SSH agent, all network protocols denied, hooks disabled, no remotes, no candidate checkout and no candidate execution. A disposable bare repository receives only the approved base snapshot, including shallow-checkout support. The validated patch is applied to an index. The bundle must contain one direct child of the base, match the entire patched tree, contain no unreachable objects, and change only regular mode-100644 `src/budget.mjs`. Git strict validation remains mandatory.

Threat detection, its success dependency, the frozen acceptance suite, networkless read-only unprivileged container, and byte-for-byte actual PR verification remain unchanged. The candidate cannot modify the verifier or tests.

## Verification and review

- Reproduction against original artifact: expected original verifier failure reproduced.
- Corrected transport against original artifact: PASS, exact tree/source hashes above, only the authorized source file differs.
- `node --test scripts/policy.test.mjs scripts/transport.test.mjs`: 54 PASS, 0 FAIL, 0 skipped on Node 22.22.0 / Git 2.56.0.windows.4.
- Negative cases cover forged/checksum-corrupt bundles, malformed JSON/pack/deltas, source/target expansion bombs, tree disagreement, hidden files, extra/intermediate/merge history, symlinks, hard links, modes, extra/missing artifacts, wrong branch/base/commit, unreachable objects, poisoned Git environment and network refusal.
- `git diff --check`: PASS. Frozen source/tests, policy, evaluator, acceptance adapter, feature workflow source/lock and delivery verifier are unchanged.
- Frozen Docker 16-case acceptance: NOT RUN. Existing local Docker Linux daemon is unavailable. No VM-only or host execution is substituted; no shared service was started.
- Independent AI advisory review identified and resolved a bounded-read race and shallow-base compatibility requirement. It found no remaining critical/high issue in the reviewed revision. This is NOT qualified human security approval.
- The independent reviewer also executed the full 54-test suite separately (54 PASS, exit 0) and separately reproduced the original-artifact transport PASS with identical head, tree and hashes. This did not execute the candidate or replace the frozen container acceptance.
- A named qualified human must review the final immutable trusted-verifier diff and evidence before security authorization. Cancelled threat detection supplies no clearance.

## Cost, next gate and rollback

This remediation requested no inference, purchases, keys or Actions runs. Original coding usage records 100576 input tokens (81630 cached), 1612 output tokens and 6.2175 gh-aw accounting units. These are not Copilot credits or independently verified dollars. Cancelled detector usage and final OpenAI billed total remain unavailable. The earlier $5 credit purchase is prepaid funding, not measured usage.

NO-GO for a new cloud run until the frozen 16 cases pass in the existing required isolation, independent qualified human review is attributable, and Amit explicitly authorizes a new paid attempt. Actions remains disabled by the previous verified cleanup; this change makes no Actions-policy request. The connector cannot refresh administration settings after temporary CLI logout, so a future launch must read them back through authorized administration access.

After a separately authorized merge, approve the new exact main SHA and obtain fresh deterministic QA for that SHA. The old run's authorization and QA do not transfer. No feature.md/feature.lock.yml change or gh-aw upgrade is proposed; the trusted script implementation and QA command change. The captured old-base artifact is offline evidence only, not a dispatch/publication authorization.

Rollback before merge: close this draft and leave main at its original base, with Actions disabled. After any separately approved merge, revert this remediation commit through a reviewed PR; keep Actions disabled. Do not remove or rewrite original artifacts, tests, or logs. No production rollback is involved.
