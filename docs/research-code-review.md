# IEEE draft → existing learning code

Source: `zhugez/Stella`, commit `08666433d99689a45bbc439e54e09df448f6410e`, `docs/research/ieee-cefr-ielts/stella_ieee_{en,vi}.tex`. Both sources were retrieved through the browser; they are not present in this checkout. These are design manuscripts, not validated interventions.

| Draft recommendation | Observed existing behavior | Bounded response |
| --- | --- | --- |
| Separate self-reported starting vocabulary from IELTS targets; include A1 | Onboarding starts at A2 and labels B1–C2 with IELTS band targets | Include A1, describe vocabulary tasks instead of band conversions; preserve B1 default and existing numeric settings |
| Preserve first submitted answers before feedback/retries | `answer()` guards card grades but can overwrite pending feedback and append retries on duplicate submission | Enforce current-step and pending guards in the shared session function; regression-test duplicate and stale submissions |
| Do not grade unavailable content | Quiz hotkeys are registered before the entry-loading guard | Block submission until the entry exists; leave loading/error recovery separate from grading |
| Preserve vocabulary scheduling and backup compatibility | FSRS cards and version-2 backups already exist | Keep schema and FSRS unchanged; exercise backup round trips and retry behavior |
| Keep sentence exploration distinct from comprehension | Reading explicitly says the sentences share a subject, not a story | Preserve; do not invent a comprehension score |
| Reviewed coherent passages, independent reading attempts, calibrated estimates | No reviewed passage corpus or reading-assessment domain exists | Defer: a new platform/content project, not a validated optimization of existing behavior |

Baseline before edits: `npm test` 32 passed; `npm run build` passed (includes TypeScript); `npm run oxlint` passed.

## Verification

- `npm test`: 38 passed (baseline: 32). New tests cover duplicate first submissions, stale submissions/double continue, retry/backup invariants, serialized intro → quiz → feedback → completion, stale feedback Continue followed by an intro, and rendered onboarding A1/B1/no IELTS conversions. The first two failed before the initial patch. Completion auditor reproduced a remaining feedback → intro double-Continue skip; `advance(seconds, step)` now requires the rendered step identity, and both Learn callers supply it. The added regression preserves the next intro.
- `npm run build` (TypeScript + Vite), `npm run oxlint`, and `git diff --check`: passed. UI detector: no findings.
- Browser: desktop/mobile onboarding rendered; prior B1 default retained; choosing A1 persisted `startLevel: 0`. A learning session started with A1 vocabulary. Submitted feedback survived reload; continuing resumed the next quiz. Aborting entry-chunk requests and pressing a number did not grade or advance the quiz; removing the route and reloading restored successful submission.
- Initial independent fresh GPT review found no blockers and requested loading/resume checks, covered above. Completion auditor then identified the feedback → intro stale-Continue gap and missing persisted onboarding test; both addressed with runnable regressions. Final fresh rework review confirmed both fixes and returned OK with no issues. Reviews themselves are not substitutes for test gates.
- Original `index.html` diff compared byte-for-byte and preserved; unrelated public files untouched. No commit, push, or deployment.

Limitations: mobile document overflow was observed during onboarding; the dialog screenshot itself fits the viewport. This work does not redesign unrelated background layout. Failed entry loading still requires reload for recovery; this patch prevents grading rather than adding a new recovery UI. No learning experiment, validated proficiency estimate, or IELTS prediction is claimed. No reviewed passage corpus was supplied, so coherent-reading assessment and a separate reading store remain future work.

## Multi-model analysis and evidence check

Registry inspected; parent implementation and fresh independent GPT review completed. Gemini 3.1 Pro returned HTTP 404 before execution. Gemini 3.8 Flash produced a read-only audit artifact, but its run ended in a tool-availability error (`web_search`, `fetch_content`, `get_search_content`, `source_check` unavailable); it is not a clean successful gate.

The Gemini artifact claimed that default meaning options fall back to headwords because index definitions are Chinese. Parent checked `public/atlas/index.json`: all 7,298 rows have definitions without CJK characters, including `library` → `n. thư viện, phòng đọc sách; ...`. Thus this claimed active blocker is not reproduced in the current dataset and no speculative fix was applied. The artifact's optional unknown-ID guard is not required by current callers, which filter IDs against the Atlas. A caller boundary change should add that guard and regression test then.

No independent model finding is accepted without source/runtime verification. Advisor review was unavailable because advisor and executor resolve to the same model.
