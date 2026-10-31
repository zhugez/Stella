# Reading practice: evidence-informed implementation

The bilingual IEEE design manuscript is a proposal, not empirical validation. This slice reuses the downloaded corpus without treating vocabulary recall, comprehension practice and CEFR/IELTS proficiency as interchangeable.

## Shipped behavior

- 19 academic draft passages, two closed-form questions each, linked to explicit paragraph evidence after submission.
- All questions must be answered before any correctness or explanations appear. Native radio groups support keyboard selection. The first submission is immutable.
- Dictionary lookup marks the entire current attempt as assisted, including lookup before answering. It does not count as an incorrect response. No proficiency estimate is produced.
- Reading records live under `stella:reading:v1`, separate from vocabulary/FSRS. Draft answers and submitted feedback survive reload. A deterministic content fingerprint isolates changed passage text, keys, explanations and evidence mappings.
- Reading export/import is separate and labelled. Imports validate before writing and merge without replacing existing attempts. Vocabulary version-2 backups remain unchanged. Synchronous saves fail closed with a visible warning; external storage changes are adopted or block a stale write. This is not transactional multi-tab synchronization.
- Loading/structural content errors block reading/grading and provide Retry.

## Content gate

A bounded independent first-pass review found 29 definitely unsupported Gutenberg questions, multiple wrong works, front matter and truncated excerpts. Example: `reading-history-gutenberg-730` asks about food absent from its birth/resuscitation excerpt. `reading-science-gutenberg-2680` contains Marcus Aurelius biography rather than the stated Einstein source.

All imported classics remain quarantined in the user's original `data/reading/` files. They are not included in the deployed corpus. `scripts/publish-reading.mjs`, run by `npm run build`, publishes only the 19 academic draft IDs and fails if that set is incomplete. Old ingestion scripts are not release commands. No original data files are deleted or rewritten.

Academic questions appear supported by their linked paragraphs on first pass, but factual accuracy, CEFR level, item quality and educational effectiveness are not validated. The answer-position distribution is biased: do not use these drafts as independent proficiency evidence. A human content review and provenance/license record are required before promoting either group to a reviewed library. Existing source metadata is not proof of rights.

## Boundaries and rollback

No new FSRS model, vocabulary schema migration, IELTS prediction, timed examination or adaptive proficiency estimate. Restoring old app code leaves the independent reading key intact; old vocabulary backups still work. Import preserves an existing attempt even if an imported copy is more advanced; it never silently rewrites first results. Export before clearing browser storage.

## Verification

Automated checks cover structural validation, invalid/missing answers, unverified extract blocking, deterministic scoring, immutable submissions, version-isolated content edits and backup validation. Existing session/onboarding regressions remain in the suite. Browser checks cover all-answer gating, no pre-submit feedback, reload resume, locked results with evidence links, assisted lookup and mobile/desktop rendering. Final local gate: 45 tests passed, TypeScript/Vite build passed, oxlint and diff checks passed; Wrangler dry run passed for the existing `stella` Worker. Browser additionally verified global-search dictionary assistance, visible quota-error/disabled inputs and failed-library Retry state. Review blockers (error subscription, global lookup tracking including browser Back/hash navigation, malformed submitted backups) were corrected and regression checks added. Deployment receipt is reported separately.
