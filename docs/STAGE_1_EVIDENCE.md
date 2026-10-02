# Full-topic build and browser evidence

This evidence records the integrated nineteen-outcome MatterLab build. The independent review report is maintained separately by the parent reviewer.

## Automated checks

- `npm run build` — passed with TypeScript project checks and Vite production bundle. The bundle includes local Lexend Variable WOFF2 files. Vite reports the expected advisory that the combined JavaScript chunk exceeds 500 kB (about 1,475 kB minified / 404 kB gzip); splitting was not part of this revision.
- `npm test -- --reporter=dot` — passed: 70 unit/route/engine tests across 8 files.
- `npm run test:e2e -- --reporter=list` — independently passed: 48 Chromium browser tests with 2 workers. This includes every canonical route, the science interactions and investigation records, responsive checks, supported-WebGL persistence, 2D fallback, and context-loss recovery.
- Builder-focused browser runs also passed: WaterTopic 9/9 and the direct-route/States/Mixtures specs 15/15. The parent’s complete final suite supersedes these targeted runs.

The final mobile pass measured `document.documentElement.scrollWidth` as 375 px at a 375 px viewport. Supported WebGL was probed independently of each application fallback; the stable 3D path and forced fallback/context-loss paths are separately exercised. Browser output includes upstream Three.js Clock and `PCFSoftShadowMap` deprecation warnings; the checks reported no application page errors.

## Font and palette

Production Chrome verified `document.fonts.check("700 16px Lexend") === true`; the body and lab text use the locally bundled Lexend family. The same-origin WOFF2 subsets and OFL provenance are recorded in [asset and source provenance](PROVENANCE.md). The app and generated apparatus use cool white/blue surfaces, navy text and saturated cobalt/aqua controls, with coral, violet and gold reserved for science/topic cues.

## Production screenshots

The current home/catalogue and Mixtures visuals were captured from the refreshed production preview after the syllabus-menu and primitive upgrades:

- [Syllabus menu at desktop](../output/playwright/quality-menu.png) — all five syllabus group labels, exact 4.1 wording, direct links for both 4.1.1 activities, and the separately labelled optional examples.
- [Dissolving investigation](../output/playwright/quality-dissolving.png) — graduated beaker, stirring rod, water/ion markers, 50 g added sample, saturated-state ledger and 14 g solid remainder.
- [Pure-water molecules](../output/playwright/quality-pure-water.png) — red oxygen, white hydrogen and bonded bent H₂O markers in the graduated glass beaker.
- [Water cycle](../output/playwright/quality-water-cycle.png) and [Change Station](../output/playwright/quality-change-station.png) — production lesson examples with their controls and conserved water model.
- [Yandying bowl](../output/playwright/quality-yandying.png), [NaCl lattice](../output/playwright/quality-salt-lattice.png) and [connected industrial filtration stages](../output/playwright/quality-industrial-pipes.png) — mixture-scene visual review captures.
- [Full-topic mobile view](../output/playwright/full-topic-mobile-375.png) — 375 × 812 screenshot, with a 375 px document-width readback.

- [Water cycle at desktop](../output/playwright/full-topic-water-cycle.png) — scene, cycle controls and reservoir ledger.
- [Heating investigation graph and readings](../output/playwright/full-topic-heating-graph.png) — three measured model-time readings with graph markers.
- [Mixtures separation apparatus](../output/playwright/full-topic-mixtures-separation.png) — 3D magnetic separator, feed/output labels, and conserved mass results.
- [Pollution trial and mass graph](../output/playwright/full-topic-pollution-trial.png) — matched input, filter trial, pollutant ledger, result row and chart.
- [Pollution investigation at 375 px](../output/playwright/full-topic-mobile-375.png) — 375 × 812 viewport; the document width remains 375 px.

All five captures came from the production preview at `http://127.0.0.1:5199/`; the preview remains running. Topic assumptions and source boundaries are in the [nineteen-outcome map](OUTCOME_COVERAGE.md) and linked model notes.
