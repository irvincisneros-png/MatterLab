# MatterLab Playground Revision Independent Review

Completed 30 September 2026. This reviews the user-authorised playful redesign, Change Station and two advanced examples. GPT 6 Luna with Extra high reasoning built and integrated the revision; the parent orchestrator independently checked its models, production artifact and browser behaviour.

## Delivered scope

- States: rounded 3D water apparatus, coloured plinths, particles visible initially, compact navigation, tactile floating controls and a viewport that reserves room for those controls.
- Change Station: melting, freezing, vaporisation, condensation, sublimation and deposition. Evaporation below boiling and bulk boiling are distinct modes.
- Beyond Three: separate hydrogen ionisation and trapped rubidium-87 Bose–Einstein condensate experiments. These are optional examples and do not imply exactly five possible matter states or transforming water into either atomic model.
- All sections retain direct routes, causal controls, reset, pause and manual stepping, optional challenges and usable graphics alternatives.

## Independent verification

- `npm test`: all 27 tests passed across four model and route test files.
- `npm run test:e2e -- --workers=2`: the final full suite passed all 22 browser tests after the final viewport and plasma-display corrections, in approximately 1.3 minutes.
- `npm run build`: the parent independently rebuilt the frozen source successfully. Final assets are `index-Dyuy9Pnh.js` and `index-BKycl0GX.css`, approximately 348.71 kB and 16.82 kB gzip respectively. Vite retains its advisory for a minified JavaScript chunk above 500 kB.
- The parent separately probed plasma energy inputs from −20 through 120, confirming 24 nuclei, 24 total electrons and zero total sample charge throughout valid/clamped states. Opposite charges have opposite qE responses and neutral particles have none.
- The parent separately probed BEC temperatures from 10 through 360 nK, confirming valid monotonic fractions summing to one and conservation of 48 illustrative markers. At 90 nK the ideal preset fraction is 0.875; at the preset 180 nK threshold it is zero.
- Transition model tests cover the conserved 200 g water ledger, latent-heat plateaux, surface transfer, reversals and direct solid/vapour routes. Browser checks include actual model changes, correct boiling prompts and separate evaporation/boiling behaviour.
- Final browser tests cover supported 3D persistence, deliberately unavailable WebGL, simulated context loss/recovery, reduced motion, keyboard use, and 375 px layouts. Model-time checks verify smooth fixed-step playback without accelerating physical model time.
- The production preview was also reloaded and visually inspected in the actual Codex in-app browser. Its navigation and the complete 3D States scene were present; Change Station exposed all six scenarios.

## Review corrections

The visual review required more than a cream recolour: the CAD-style boxes were replaced, large curriculum chrome was moved into the Guide, apparatus gained coloured bases, and a real Canvas safe area was reserved above the controls. Feature workspaces were compacted so important apparatus and controls fit the desktop view.

Scientific and interaction corrections included signed vapour-pressure transfer, scenario-specific temperature bounds, proper liquid neighbour exchange, consistent ice/liquid volume bases, clear particle-view transparency, mode-specific boiling feedback, reduced-motion manual stepping, and smooth fixed-step playback. Plasma force vectors and its current-state badge now depend on the live charged-species ledger; the external field remains visible when the sample is neutral.

## Evidence and limits

Final images are in `output/playwright/`: `playground-states-desktop.png`, `playground-mobile.png`, `playground-change-station.png`, `playground-plasma.png` and `playground-bec.png`. Earlier images with `first`, `review`, `revised` or `safe` in their names are construction checkpoints rather than the final design.

See `TRANSITIONS_MODEL.md` and `ADVANCED_MODEL.md` for assumptions and sources. Surface rates are accelerated qualitative models with prescribed environmental conditions. Plasma arrows represent forces, not field-driven trajectory predictions. The BEC fraction uses an ideal fixed harmonic-trap model and an experiment-inspired threshold, not a universal threshold or a full quantum simulation. Displayed readings are rounded.

This is not a complete classroom-device performance or accessibility certification. School-device frame rates, classroom projection and school-network loading remain unmeasured. Upstream Three.js deprecation warnings are recorded; normal application flows passed without page errors. Full 4.1.1 coverage and the other Term 4 topics remain future work.

The source and earlier production baseline are preserved under `.work/matterlab-before-playground-20260930/` at the workspace root. The verified revised production preview is http://127.0.0.1:5199/. No external publication or Git commit was performed.
