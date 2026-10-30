# Atlas performance and accessibility verification

Tested the production build locally at `http://127.0.0.1:5190/#/atlas?level=B2`, then deployed and verified the live target after explicit user approval.

Production Worker `stella` now serves version `922a0408-d558-420a-9c99-c6d79e7f4e56` at 100% traffic. The deployment uploaded 7,302 modified assets and retained the existing ASSETS binding and compatibility date. No commit or push was performed, and goal continuation settings were not changed during deployment.

The pre-deployment live check served `index-Bd0Mtu95.js` with selected B2 contrast 2.232:1 and lazy nonresponsive thumbnails. The post-deployment check serves `index-ULBm-yMM.js`, with dark selected-chip text, no logo label override, and eager high-priority first-row responsive images.

## Changes

- Use stronger CEFR text colors and dark-theme selected-chip foregrounds. Darken light-theme secondary text to pass contrast checks.
- Derive the logo link name from visible text. Include the search shortcut in its accessible name.
- Replace synchronous virtualization layout reads with ResizeObserver measurements and cached scroll offsets. Skip the initial redundant scroll reset; retain resets when changing pages.
- Generate 200×200 WebP thumbnails at quality 65. The grid supplies actual display sizes and a 512px full-image candidate for high-density screens. Load the first row eagerly with high priority; keep overscan images lazy.
- Version thumbnail URLs to avoid reusing cached 256px files.

## Local measurements

Lighthouse 13.5.0, desktop, simulated throttling, CPU multiplier 1, viewport 1365×768, screen emulation disabled, extensions absent. Existing-user settings skip onboarding. These are local lab results, not production measurements. Earlier browser runs reused service-worker media, so request transfer totals are not evidence of image savings; image savings below come from actual file sizes.

| Check | Result |
|---|---|
| Final dark-theme performance | 93 |
| Final dark-theme accessibility | 100 |
| Final light-theme accessibility | 100 |
| Final TBT | 0 ms |
| Final LCP | 1,707 ms |
| Final FCP | 545 ms |
| Final forced-reflow insight | Pass; no sources listed |
| Chip contrast | 324 computed checks; minimum 5.998:1 |
| Computed logo name | `Stella IELTS` |
| First 20 B2 thumbnails | 211,930 → 143,592 bytes; 66.7 KiB saved |
| First 30 B2 thumbnails | 322,820 → 217,918 bytes; 102.4 KiB saved |
| All 7,298 thumbnails | 73,211,336 → 49,398,316 bytes |

The supplied report attributed substantial blocking time to an extension and an injected security script. A clean local pre-change run measured 30 ms TBT and approximately 103 ms of forced reflow attributed to the two Atlas geometry reads. Do not attribute the entire supplied 1,445 ms TBT reduction to application changes. Another final-build run measured 34 ms TBT, illustrating lab variability.

The compact Atlas index remains preloaded. Startup already meets the TBT target, so no data worker, data format migration, or additional route/chunk abstraction was added. Existing FSRS and galaxy bundles remain eagerly imported. The LCP image is still discovered after client-side data/rendering, not from initial HTML. AI catalog schema fixes are outside this change.

## Live verification

Requested target: `https://stella.zhugez.workers.dev/#/atlas?level=B2`. In this environment, navigation resolves to `https://stella.zhugez.workers.dev/#/atlas?level=B2`.

Three consecutive Lighthouse 13.5.0 desktop runs used simulated throttling, CPU multiplier 1, viewport 1365×768, screen emulation disabled, existing-user settings, and the service-worker script blocked. No extension/security script appeared among the page's loaded scripts, and Lighthouse reported no run warnings.

| Run | Performance | Accessibility | TBT | LCP |
|---|---:|---:|---:|---:|
| 1 | 52 | 100 | 300 ms | 6,239 ms |
| 2 | 86 | 100 | 97 ms | 2,370 ms |
| 3 | 92 | 100 | 0 ms | 1,779 ms |
| Median | 86 | 100 | 97 ms | 2,370 ms |

Report all runs rather than presenting the best run as a stable guarantee. The median meets the sub-300 ms TBT target, but the first run was exactly 300 ms. No application source was attributed forced reflow; run 2 listed 41.628 ms as unattributed, and runs 1/3 listed no sources.

A separate light-theme audit scored accessibility 100. The live UI regression script passed all checks: 2,127 B2 results, 324 chip-state/theme contrast checks (minimum 5.998:1), logo name, search, entry dialogs, level/topic/status filters, navigation, grid/list scrolling, and mobile high-density selection of the 512px candidate. Direct live responses for philosophy, stunning, scholar, release, errand, and pit thumbnails returned HTTP 200 with 200×200 dimensions and byte sizes matching the regenerated files.

Wrangler is pinned locally at 4.156.0 for repeatable deployment. Its workerd install script is explicitly allowed by the existing pnpm build-approval policy. Deployment used `pnpm exec wrangler deploy --config wrangler.json --keep-vars --strict` after local gates and a dry run. Previous version `9018ffc4-df5e-419a-a9b5-5c79ed3c96de` is retained as a rollback target; rollback was not executed.

## Reproduction

```sh
npm run build
npm run preview -- --port 5190
# In another terminal, with agent-browser installed:
node scripts/check-atlas-ui.mjs
# Live behavior checks in an isolated browser session:
node scripts/check-atlas-ui.mjs 'https://stella.zhugez.workers.dev/#/atlas?level=B2'
npm run oxlint
npm run check:atlas
npm test
```

The UI check uses an isolated browser session and closes it afterward. It verifies the logo name, light/dark/system chip states, search, word dialog opening/closing, CEFR/topic/status filters, page navigation, bounded grid/list virtualization during scrolling, and a two-column high-DPI mobile grid selecting the 512px candidate.

Build, UI check, lint, dataset validation, all 22 unit tests, and `git diff --check` pass. Dataset validation reports zero errors. A disposable archive of pristine HEAD reproduced the original failing collocation assertion (20 passes, one failure), proving it predated these changes. The test now matches the documented Vietnamese-only behavior and checks a positive Vietnamese case; `splitPair` and translation behavior are unchanged.

Independent read-only code review found no issues and returned “OK with notes.” The reviewer inspected source and supplied artifacts, but did not rerun the tests. The subsequent live verification is documented above. Remaining limits are lab-result variability, client-side LCP discovery, and eager FSRS/galaxy imports.

Final audit artifacts from this session are `/tmp/stella-final-dark.json`, `/tmp/stella-final-dark-0.trace.json`, `/tmp/stella-final-light.json`, and `/tmp/stella-final-ui.log`. Live artifacts are `/tmp/stella-production-deploy.log`, `/tmp/stella-postdeploy-versions.json`, `/tmp/stella-live-dark.json`, `/tmp/stella-live-dark-repeat.json`, `/tmp/stella-live-dark-third.json`, `/tmp/stella-live-light.json`, `/tmp/stella-live-ui.log`, and `/tmp/stella-live-image-bytes.json`. Temporary paths are not durable across environment cleanup.
