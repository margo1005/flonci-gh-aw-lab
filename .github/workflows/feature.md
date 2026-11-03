---
name: HEB-BUDGET-001 isolated feature
on:
  workflow_dispatch:
    inputs:
      approved_sha:
        description: Exact reviewed main commit
        type: string
        required: true
permissions:
  contents: read
runs-on: ubuntu-24.04
engine:
  id: codex
  version: "0.164.0"
  model: gpt-6.1-sol
timeout-minutes: 10
max-turns: 12
max-ai-credits: 50
concurrency:
  group: heb-budget-001
  cancel-in-progress: false
  job-discriminator: ${{ github.run_id }}
network:
  allowed: []
tools:
  bash: true
  github: false
safe-outputs:
  create-issue: false
  create-pull-request:
    draft: true
    max: 1
    fallback-as-issue: false
    auto-close-issue: false
    base-branch: main
    allowed-branches: [heb-budget-001]
    allowed-files: [src/budget.mjs]
    max-patch-files: 1
    max-patch-size: 16
  report-missing-tool: false
  report-missing-data: false
  report-failure-as-issue: false
  report-failed-jobs: false
  noop:
    report-as-issue: false
  threat-detection:
    enabled: true
    continue-on-error: false
    report-as-issue: false
    max-ai-credits: 20
  needs: [independent_acceptance]
jobs:
  preflight:
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      actions: read
    timeout-minutes: 2
    steps:
      - name: Require explicit isolated run approval
        env:
          INPUT_SHA: ${{ inputs.approved_sha }}
          APPROVED_SHA: ${{ vars.PILOT_APPROVED_SHA }}
          APPROVAL_EXPIRES: ${{ vars.PILOT_APPROVAL_EXPIRES }}
          REPO: ${{ github.repository }}
          REF: ${{ github.ref }}
          SHA: ${{ github.sha }}
          ACTOR: ${{ github.actor }}
          ATTEMPT: ${{ github.run_attempt }}
        run: |
          node --input-type=module -e '
          import assert from "node:assert/strict";
          const e=process.env;
          assert.equal(e.REPO,"margo1005/flonci-gh-aw-lab");
          assert.equal(e.REF,"refs/heads/main");
          assert.equal(e.ACTOR,"margo1005");
          assert.equal(e.ATTEMPT,"1");
          assert.match(e.APPROVED_SHA,/^[a-f0-9]{40}$/);
          assert.equal(e.INPUT_SHA,e.SHA);
          assert.equal(e.APPROVED_SHA,e.SHA);
          const expiry=Date.parse(e.APPROVAL_EXPIRES);
          assert(expiry>Date.now() && expiry-Date.now()<=86400000);
          '
      - name: Require successful deterministic cloud QA on this SHA
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          node --input-type=module -e '
          import assert from "node:assert/strict";
          const e=process.env;
          const r=await fetch("https://api.github.com/repos/margo1005/flonci-gh-aw-lab/actions/workflows/laboratory-qa.yml/runs?event=workflow_dispatch&status=success&head_sha="+e.GITHUB_SHA+"&per_page=1",{headers:{Authorization:"Bearer "+e.GH_TOKEN,Accept:"application/vnd.github+json"}});
          assert(r.ok);
          const run=(await r.json()).workflow_runs?.[0];
          assert(run && run.head_sha===e.GITHUB_SHA && run.conclusion==="success" && run.actor.login==="margo1005" && Date.now()-Date.parse(run.created_at)<86400000,"Fresh cloud QA is required");
          '
  agent:
    needs: [preflight]
    timeout-minutes: 15
  detection:
    timeout-minutes: 5
  safe_outputs:
    if: needs.independent_acceptance.result == 'success'
  independent_acceptance:
    needs: [agent, detection]
    outputs:
      source_sha256: ${{ steps.verify.outputs.source_sha256 }}
    runs-on: ubuntu-24.04
    permissions:
      contents: read
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.sha }}
          persist-credentials: false
          path: trusted
      - uses: actions/download-artifact@v8.0.2
        with:
          name: agent
          path: agent-artifact
      - id: verify
        name: Independently verify proposed patch
        run: node trusted/scripts/verify-patch.mjs agent-artifact
  verify_delivery:
    needs: [agent, detection, independent_acceptance, safe_outputs]
    if: needs.independent_acceptance.result == 'success' && needs.safe_outputs.result == 'success'
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      pull-requests: read
    timeout-minutes: 3
    outputs:
      head_sha: ${{ steps.delivery.outputs.head_sha }}
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.sha }}
          persist-credentials: false
          path: trusted
      - id: delivery
        name: Verify actual draft PR bytes
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ needs.safe_outputs.outputs.created_pr_number }}
          VERIFIED_HASH: ${{ needs.independent_acceptance.outputs.source_sha256 }}
        run: node trusted/scripts/verify-delivery.mjs
  publish_check:
    needs: [detection, verify_delivery]
    if: needs.verify_delivery.result == 'success'
    runs-on: ubuntu-24.04
    permissions:
      checks: write
    timeout-minutes: 2
    steps:
      - uses: actions/github-script@v9.0.0
        env:
          VERIFIED_HEAD: ${{ needs.verify_delivery.outputs.head_sha }}
        with:
          script: |
            const sha=process.env.VERIFIED_HEAD;
            if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Missing verified head');
            await github.rest.checks.create({
              ...context.repo, name:'HEB-BUDGET-001 / independent acceptance',
              head_sha:sha,status:'completed',conclusion:'success',
              output:{title:'16 frozen acceptance tests passed',
                summary:'הקוד ב־Draft PR זהה לקוד שעבר בדיקה עצמאית. staging וייצור לא נבדקו. אין אישור ל־merge או deployment.'}
            });
  executive_report:
    needs: [agent, detection, independent_acceptance, safe_outputs, verify_delivery, publish_check]
    detection-gate: status-only
    if: always()
    runs-on: ubuntu-24.04
    permissions: {}
    timeout-minutes: 2
    steps:
      - name: Hebrew executive outcome
        env:
          AGENT: ${{ needs.agent.result }}
          SECURITY: ${{ needs.detection.result }}
          TESTS: ${{ needs.independent_acceptance.result }}
          DELIVERY: ${{ needs.verify_delivery.result }}
          CHECK: ${{ needs.publish_check.result }}
        run: |
          node --input-type=module -e '
          import {appendFileSync} from "node:fs";
          const e=process.env;
          const accepted=e.TESTS==="success"&&e.DELIVERY==="success"&&e.CHECK==="success";
          appendFileSync(e.GITHUB_STEP_SUMMARY,
            "# דוח ניסוי HEB-BUDGET-001\n\n"+
            "תוצאה: "+(accepted?"הפיצר עבר קבלה עצמאית ונמסר כטיוטת PR.":"הניסוי לא הוכיח מסירה תקינה.")+"\n\n"+
            "כתיבת קוד: "+e.AGENT+"\nבדיקת אבטחה: "+e.SECURITY+"\nקבלה עצמאית: "+e.TESTS+"\nאימות PR: "+e.DELIVERY+"\n\n"+
            "staging וייצור: לא נבדקו. נדרש אישור נפרד לכל merge, deployment או הרחבה.\n");
          '
---
# One synthetic Hebrew feature

Read requirements/HEB-BUDGET-001.json and tests/budget.test.mjs. Convert the Hebrew request into a short acceptance checklist, then implement only src/budget.mjs.

Run node scripts/local-acceptance.mjs. If behavior fails, make at most one repair and run the tests once more. Stop on security, credentials, infrastructure, or budget errors. Do not ask the founder for coding instructions or retry prompts. The hard outer bounds are 12 turns and 10 minutes; there is no automatic workflow rerun.

Use the exact branch name heb-budget-001 and keep the proposed change to one commit. Use create_pull_request once with a Hebrew summary. It must remain a draft. Report what works, failures, and what remains unverified. Independent acceptance is decided by the trusted job, never by your own claim. Staging and production are NOT VERIFIED. No network, dependencies, other repositories, secrets, merges or deployments.
