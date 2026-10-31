# Stella: Evidence-informed CEFR–IELTS reading design — IEEE conference-style drafts

**Repository edition:** The PDF outputs are generated from these sources with XeLaTeX and BibTeX. Precompiled PDFs are supplied separately in the associated research package, not tracked in Git.

**Status:** Research/design manuscript, **not** a published, submitted, peer-reviewed, or empirically validated IEEE paper. The author identity and target conference remain unspecified. This file is maintained in the Stella repository.

## Files

| File | Contents |
| --- | --- |
| `stella_ieee_en.tex` | Full English research manuscript in `IEEEtran` conference mode. |
| `stella_ieee_vi.tex` | Full Vietnamese counterpart, the same questions, architecture, formulas, caveats, and source base. |
| `references.bib` | Shared bibliographic records with DOI or authoritative URL. |
| `EDITORIAL_METHOD.md` | Writing and evidence-quality checklist and sample revisions. |

## Build

Requires a recent LaTeX distribution containing `IEEEtran`, XeLaTeX, BibTeX, `fontspec`, `babel-vietnamese`, `booktabs`, `tabularx`, `balance`, and the Liberation fonts.

```sh
xelatex -interaction=nonstopmode -halt-on-error stella_ieee_en.tex
bibtex stella_ieee_en
xelatex -interaction=nonstopmode -halt-on-error stella_ieee_en.tex
xelatex -interaction=nonstopmode -halt-on-error stella_ieee_en.tex

xelatex -interaction=nonstopmode -halt-on-error stella_ieee_vi.tex
bibtex stella_ieee_vi
xelatex -interaction=nonstopmode -halt-on-error stella_ieee_vi.tex
xelatex -interaction=nonstopmode -halt-on-error stella_ieee_vi.tex
```

On the current development image `/usr/bin/bibtex` points to a broken alternative; `bibtex8` was used successfully in its place. Use `bibtex8 stella_ieee_en` / `bibtex8 stella_ieee_vi` if that happens on your system. On Overleaf, choose **XeLaTeX** as the compiler and allow BibTeX to run. The papers use `\documentclass[conference,10pt]{IEEEtran}` and the numbered IEEEtran BibTeX style. The layout uses US Letter. A target venue may require A4, anonymity, a strict page limit, or a particular template release.

## Scope and cautions

- The literature component is a **targeted narrative synthesis**, **not** a PRISMA systematic review or a new meta-analysis.
- Source observations were drawn from `https://github.com/zhugez/Stella` as reviewed on 31 October 2026; a source-code inspection alone does not confirm runtime defects.
- Examples of questions, design weights, statistical estimands, and acceptance criteria are proposed **future work**.
- CEFR descriptors and IELTS test scores measure different constructs; no automatic band conversion is offered.
- IEEE format **does not** imply endorsement by IEEE or suitability for a particular conference. The Vietnamese translation is a companion scholarly version; most submissions must comply with the conference's required language.
- Author names, affiliation, funding, ethics and competing-interest disclosures require confirmation by the real contributor(s). The template uses an explicit author placeholder to avoid inventing identities.

## Why the writing is specific

This work combines (i) **case observations** about `Reading.tsx`, `drills.ts`, `Onboarding.tsx`, and the local-first store, (ii) **evidence** from named, traceable studies and official test frameworks, and (iii) **falsifiable evaluation** on unseen reading passages. We avoided unsupported first-person professional anecdotes. The prose borrows clarity principles from `danyuchn/asd-ste100-skill` (consistent terminology, defined agents, one claim at a time), without claiming formal compliance with the aerospace standard or treating writing style as learning-effectiveness evidence.

## Pre-submission checklist

1. Replace the author placeholder with accurate author information and affiliation.
2. Confirm every bibliography record and the precise venue's language and paper-type rules.
3. Check any updated state of Stella source before making claims about current code.
4. Obtain human proofreading of English and Vietnamese abstracts, mathematical notation, and translation equivalence.
5. Disclose any AI assistance and data provenance according to the target conference's policy.
6. Obtain ethics approval / informed consent where necessary before user experiments.
7. Follow the venue-specific PDF eXpress / PDF Checker instructions; local compilation alone does not establish IEEE Xplore compliance.

### Authoritative guidelines

- IEEE Author Center: https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/authoring-tools-and-templates/
- IEEE paper structure: https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/structure-your-paper/
- IEEE technical English: https://conferences.ieeeauthorcenter.ieee.org/write-your-paper/write-in-technical-english/
- Simplified Technical English skill: https://github.com/danyuchn/asd-ste100-skill