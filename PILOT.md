# HEB-BUDGET-001 pilot runbook

This repository is strictly synthetic. Only src/budget.mjs is the coding target. The starter intentionally fails all 16 frozen acceptance cases. No application feature has been delivered yet.

## Fixed contract

The Hebrew request, precedence rules, exact messages and 16 cases are in requirements/HEB-BUDGET-001.json. The frozen UTF-8 test SHA256 is ac100cdc9a9b8c9626dfbffec4a60ccf743ceec60c4deb125a1f08cb2070b4c2. A changed test digest fails verification.

## Execution

Manual deterministic QA, then one separately authorized feature dispatch:
preflight approval → one native Codex coding session → strict threat detection → trusted independent tests → native draft PR → exact PR-byte verification → check on the actual PR head → Hebrew executive report.

No push, pull_request, pull_request_target, issue or schedule trigger is configured. No automatic workflow reruns. The agent is instructed to test, repair once, and retest. That repair count is a prompt rule; the enforced outer limits are 12 turns, 10 minutes and 50 AI credits for coding, plus a separate 20-credit threat detector. This is one coding agent; security detection also consumes inference.

The custom verifier reads the frozen suite from the approved main SHA, accepts exactly one regular-file patch, rejects bundles, path traversal, wrong bases, mode changes and additional files, and checks the candidate in a separate networkless read-only container. Assertions execute outside the candidate process. No credential is passed to candidate execution. Only successful independent acceptance permits publication. Actual PR bytes must equal the tested source hash before a success check is attached to its exact head.

## Permissions

| Job | Runtime GitHub permissions |
| --- | --- |
| Coding | contents: read |
| Acceptance / deterministic QA | contents: read |
| Delivery audit | contents: read, pull-requests: read |
| Native safe output publisher | contents: write, pull-requests: write, issues: write |
| Native conclusion | compiler-generated read scopes plus issues: write |
| Verified-head check publisher | checks: write |
| Hebrew status report | none |

The pinned compiler retains issues:write on its publisher/conclusion even when issue reporting is disabled. Built-in job overrides do not remove it. This bounded framework permission is confined to this synthetic repository; it is not granted to the coding agent. No PAT, custom GitHub App, deployment, OIDC, package, or other-repository access is needed. CODEX_API_KEY / OPENAI_API_KEY appear only as native secret references; no secret value is stored here.

## Before an authorized cloud run

1. Read back Actions disabled, main protection active with no bypass, CODEOWNERS, and this exact reviewed commit.
2. Use a dedicated lab project in a separately billed OpenAI organization. Verify project hard-limit enforcement, available credits, model access and adequate token/request limits. Never use production keys.
3. Provision only one restricted, short-lived lab key using the approved secure key flow; place it in this repository's CODEX_API_KEY secret. Permit only necessary model inference/model listing. Do not grant administrative APIs.
4. After explicit approval, enable only the reviewed pinned actions; keep the default token read-only. Enable GitHub's PR-creation switch for this repository only. GitHub combines creation/approval in that switch; no review-approval handler exists in this workflow.
5. Set PILOT_APPROVED_SHA to the reviewed main commit and PILOT_APPROVAL_EXPIRES to an ISO UTC timestamp within 24 hours. These are absent during Phase A, so the preflight fails closed.
6. Dispatch laboratory-qa.yml once. No inference occurs. Stop on any failure.
7. Dispatch feature.lock.yml once, on main, with approved_sha equal to PILOT_APPROVED_SHA. Do not rerun a failed workflow; run_attempt must equal 1.
8. Inspect the independent check on the final PR head, native usage evidence, Hebrew report, and absence of additional changed files. Disable Actions again and revoke the lab key after evidence collection.

## Acceptance and evidence

GO for this one synthetic feature requires 16/16 frozen cases, passing threat detection, only src/budget.mjs modified, one draft PR, byte-for-byte tested-code delivery, a trusted success check on the final head, zero founder coding/retry prompts after approval, and no unauthorized external access or cost.
Record founder active minutes after approval (target <=5), number of interventions (target 0), elapsed run time (target <=30 minutes), API usage, and terminal failure category. Compare founder minutes with a separately recorded manual baseline; do not invent percentage savings.

Code completion is an agent claim. Feature acceptance requires the independent check. Staging readiness and production release remain NOT VERIFIED. Future identity, authorization, security or data work requires qualified human review and separate release authorization.

## Rollback

Cancel an active run, disable repository Actions, remove the approval variables, revoke only the lab API key, and close any trial draft PR. Retain immutable evidence; no merge means main application code remains the starter. Do not delete the repository or shared billing data, alter other projects, or change existing credentials.

## Phase A evidence and limits

Pinned gh-aw v1.0.1 compiled with strict mode: 1 workflow succeeded, 0 warnings. All emitted action references are full commit SHAs. Independent policy tests: 13 passed. Local reference control: 16/16 passed. Starter: 0/16; six faulty/tampering controls rejected. These are local deterministic controls, not a completed Codex feature or a cloud E2E pass. Cloud runner/container integration and paid inference have NOT RUN because Actions remain disabled. Exact installed binaries and the verifier image digest are recorded in TOOLCHAIN.json.

Required protection before execution: block main updates outright with no bypass during the draft-only pilot. The required check is initially Any source because GitHub Actions is not selectable before a run exists. Bind it to GitHub Actions after the first deterministic QA run; do not relax the main update restriction. The preflight additionally requires successful cloud QA on the exact SHA within 24 hours.
