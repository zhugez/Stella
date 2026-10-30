<div align="center">

<img src="docs/assets/cover-v2.jpg" alt="Stella — illustrated IELTS vocabulary" width="100%">

# Stella

An illustrated IELTS vocabulary and practice app. Every word gets its own painting, native UK/US audio, and FSRS scheduling.

[**Live app**](https://stella.zhugez.workers.dev) · [**Dataset**](data/) · [**Brandkit**](BRANDKIT.md) · [**Roadmap**](#roadmap)

[![Code: GPL-3.0](https://img.shields.io/badge/code-GPL--3.0-17283B?style=flat-square)](LICENSE)
[![Dataset: CC BY 4.0](https://img.shields.io/badge/dataset-CC%20BY%204.0-AD5038?style=flat-square)](CONTENT_LICENSE.md)

<sub>[Tiếng Việt](README.vi.md)</sub>

</div>

---

Stella is a local-first web app for building IELTS vocabulary. It covers 7,298 words across the six CEFR levels, each with an original illustration, a context sentence, native UK and US recordings, collocations, and a Vietnamese gloss and usage note.

There is no account and no server-side state. Progress lives in the browser and can be exported as JSON.

<table>
  <tr>
    <td width="50%"><img src="docs/assets/atlas-desktop.jpg" alt="Illustrated word atlas" width="100%"></td>
    <td width="50%"><img src="docs/assets/galaxy.jpg" alt="3D word galaxy" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><sub>Atlas — browse and filter all 7,298 words</sub></td>
    <td align="center"><sub>Galaxy — the same words as an interactive star map</sub></td>
  </tr>
</table>

## Features

**Atlas.** Each painting depicts the situation described in that word's example sentence, so the image and the sentence refer to the same event. Filter by CEFR level or by one of 19 IELTS topic clusters.

**Study cards.** Definitions, example sentences, word family, synonyms, antonyms, and collocations, plus a note on register and prepositions that trip up Vietnamese speakers.

**Multilingual cards.** All 7,298 entries and 24,722 collocations carry Vietnamese, Chinese, and French glosses alongside the English. The language-pair picker flips the card between EN→VI, VI→EN, ZH→VI, VI→ZH, FR→VI, and VI→FR.

**FSRS scheduling.** Review timing comes from [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs), the scheduler behind modern Anki. It estimates memory stability and retrievability per card and queues reviews just before recall drops.

**Galaxy.** All 7,298 words laid out as stars in a WebGL2 particle field. Each star's size and colour come from that card's review state: unseen words are dim stardust, learned ones brighten and grow, mastered ones turn gold and carry a halo. Today's due cards are drawn with a wide halo so they stay visible at low zoom.

**Practice.** Three typing modes for active recall: type the word from its painting, transcribe a sentence, or write out what you hear from native audio.

**Soundscapes.** Optional background audio (rain, cafe, coast, forest, fireplace) that ducks automatically when a pronunciation clip plays.

**Offline.** A service worker caches the app shell and audio for use without a connection.

## Dataset

| | |
|---|---|
| Words | 7,298 |
| CEFR levels | A1 (785) · A2 (1,039) · B1 (1,465) · B2 (2,127) · C1 (1,608) · C2 (274) |
| Topic clusters | 19 |
| Collocations | 24,722 |
| Audio | 22,905 native UK and US clips |
| Gloss languages | English, Vietnamese, Chinese, French (full coverage) |
| Files | [`public/atlas/entries/`](public/atlas/entries/) (73 chunks) · [`data/word-atlas.json`](data/word-atlas.json) |

## Stack

React 19 · TypeScript 5.9 · Vite 6 · pnpm · `ts-fsrs` · WebGL2 · Cloudflare Workers

Linting runs on [Oxc](https://oxc.rs/).

Cloudflare accepts at most 20,000 files per deployment and the audio set is 22,905 clips, so the audio is not bundled with the build. Instead `src/worker.ts` intercepts `/atlas/audio/*`, serves it from the repository over GitHub's raw endpoint, and caches it at the edge. The build also strips `dist/atlas/audio` before upload.

## Getting started

Requires Node.js 20+ and pnpm 10+.

```bash
git clone https://github.com/zhugez/stella.git
cd stella
pnpm install
pnpm dev          # http://localhost:5188
```

Other scripts:

```bash
pnpm build        # type-check and build to dist/
pnpm preview      # serve the production build
pnpm test         # unit tests (node:test + tsx)
pnpm oxlint       # lint
pnpm check:atlas  # validate the word dataset
```

Deploying needs a Cloudflare account and `pnpm dlx wrangler login`:

```bash
pnpm deploy
```

## Roadmap

Vocabulary, illustration, audio, and spaced repetition are complete. The remaining IELTS skills are not built yet.

- [x] Atlas — 7,298 illustrated words with UK/US audio
- [x] FSRS review scheduling
- [x] Typing and dictation practice
- [x] PWA and edge deployment
- [ ] Listening — cloze tests with audio speed control and transcripts
- [ ] Reading — academic passages with tap-to-inspect vocabulary
- [ ] Writing — Task 1 and Task 2 prompts with collocation banks

## Attribution

Built and maintained by [zhugez](https://github.com/zhugez).

Stella is a fork of [Word Atlas](https://github.com/designfuchen/word-atlas) by [Yang Lei (@designfuchen)](https://github.com/designfuchen). The application itself — the atlas, the WebGL galaxy, the FSRS scheduler, the typing studio, and the soundscapes — is upstream work and is reused under its licenses.

What this fork adds:

- Vietnamese, Chinese, and French glosses for all 7,298 entries and 24,722 collocations
- A bidirectional language-pair picker across the card, filter, and practice views
- pnpm and Oxc tooling in place of npm and ESLint
- Cloudflare Workers deployment with an edge audio proxy, plus a PWA service worker

## License

- Code: [GPL-3.0](LICENSE)
- Dataset and illustrations: [CC BY 4.0](CONTENT_LICENSE.md)
