# MatterLab Science Playgrounds

MatterLab is a locally running Year 7 Term 4 science simulator. The default `/` and `/#/` entries open the syllabus menu, where all nineteen exact supplied outcomes appear in the original syllabus sections and numerical order. Each entry opens its working lesson; 4.1.1 links to both the Earth water cycle and three-state comparison. The original States of Matter comparison, six-transition Change Station and optional plasma/Bose–Einstein models remain available.

The persistent Menu link returns from each lesson. Routes use `/#/simulators/CODE`, for example `/#/simulators/4.2.2` opens the liquid-density measurement lab and `/#/simulators/4.4.5` opens the source-context yandying investigation. The Matter area also keeps `/#/changes/TRANSITION` and optional `/#/advanced/plasma` / `/#/advanced/bec` routes available.

## Run locally

```bash
npm install
npm run dev
```

The checked production preview is served at `http://127.0.0.1:5199/`. No account or network service is required to use the simulations. The type-checked production bundle and local Lexend Variable fonts are built with `npm run build`.

## Verify

```bash
npm run build
npm test
npm run test:e2e
```

The current browser suite targets Chromium on port 5197, uses two workers, independently probes WebGL, and includes an accessible 2D fallback path. Three.js currently emits upstream Clock and shadow-map deprecation warnings; these are warnings, not MatterLab runtime errors.

## How to read the models

These are interactive teaching models with explicit boundaries, not calibrated laboratory instruments or forecasts. Virtual investigations let students change a cause, take model readings, record trials and compare results. Measurement references, physical assumptions, source context and simplifications are documented beside the topic coverage.

The interface uses locally bundled Lexend Variable Latin and Latin Extended fonts. Apparatus and particle markers are code-generated; there are no runtime external models, images, fonts, APIs or analytics.

See [the nineteen-outcome coverage map](docs/OUTCOME_COVERAGE.md), [controls and accessibility](docs/CONTROLS.md), [science model boundaries](docs/SCIENCE_MODEL.md), [Mixtures model](docs/MIXTURES_MODEL.md), [source/font provenance](docs/PROVENANCE.md), [browser evidence](docs/STAGE_1_EVIDENCE.md) and each linked Water, Solutions, Pollution, Transition and Advanced model note.
