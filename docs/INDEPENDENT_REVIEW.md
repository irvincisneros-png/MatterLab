# MatterLab States of Matter Independent Review

Review date: 30 September 2026. Reviewer: parent orchestrator. Builder: delegated GPT 6 Luna with Extra high reasoning.

This review concerns the completed first States of Matter prototype. It does not certify the complete Year 7 Term 4 collection. Implementation and independent verification are complete within this stage; user review remains pending before expansion.

## Independently verified behaviour

- Production build completed with TypeScript checking. The reviewed compressed JavaScript was approximately 333 kB and CSS approximately 9 kB, excluding the small HTML and favicon. This is a transfer-size measurement, not a load-time benchmark.
- The two model and route test files passed all 10 tests when rerun by the parent. Tests cover initial temperatures, phase plateaux, fractions, bounds, particle identities, time versus energy, liquid surfaces and curriculum routes.
- The final strengthened browser suite passed all eight tests in the parent's independent run with two workers, in 37.1 seconds. Its persistence check independently probes WebGL availability and requires supported browsers to retain the 3D canvas after startup and view changes.
- Separate parent engine probes checked initial ice at −20 °C, liquid at 22 °C and vapour at 118 °C. Quarter and three-quarter phase mixtures stayed at the corresponding ideal transition temperature.
- A separate position sweep checked 675 combinations of three seeds, fifteen energy states, three tilt angles and five times. All 12,150 represented positions were finite and within the chamber centre bounds, with eighteen identities in every sample.
- In the production browser, two additions of 20 kJ to initial ice changed energy from −8.4 to 31.6 kJ. Temperature remained 0 °C, with displayed fractions of 53 percent ice and 47 percent liquid.
- Space activated a focused heat button normally. Escape closed the guide and restored focus to its trigger.
- Five successive Chrome 3D to 2D to 3D cycles produced no console errors after the label portal repair. All three app-owned labels remained present.
- The revised 375 pixel viewport showed all three vessels after the camera fit correction. Desktop and tablet views were visually inspected at 1366 by 768 and 1024 by 768.
- Presentation view enlarged the labels and scene while retaining essential motion and tilt controls. The page may scroll for secondary notes.
- A fresh reduced-motion load started paused. Manual single stepping remained available.
- A separate browser experiment deliberately made WebGL contexts unavailable before page load. The app displayed the 2D model and the graphics-unavailable status. Single stepping changed particle positions. The injected renderer failure logged caught errors; this is distinct from normal-use console errors.
- Playwright WebKit 26.6 rendered the 3D scene and particles, and completed three successive 3D to 2D to 3D cycles without console errors. This is a WebKit engine smoke check, not a complete native Safari certification.

## Review findings corrected during construction

The review identified incorrect initial liquid energy, gas movement resembling local vibration, outdated descriptions after transformation, challenge completion handling, native keyboard activation, small classroom text, undersized scene framing, missing or overlapping labels, portal cleanup errors, liquid particles below the floor, shallow tilted-liquid geometry and narrow-screen camera clipping. The builder revised these before the successful checks above.

A late fallback regression was caught by actual production inspection: an effect inside the native canvas fallback ran even on supported browsers and forced 2D. This was removed, replaced with an actual capability probe, and covered by the strengthened persistence test. Final production inspection confirmed one persistent 3D canvas, no fallback and no normal-use console errors after loading and enabling particles.

The final ice and liquid meshes share a 1.44 by 0.46 cross-section, with ice height scaled by 1.09 for the equal-mass comparison. Source and final image inspection confirmed the correction. Primary explanatory text was darkened to RGB 96, 116, 124, approximately 4.9 to 1 contrast on white. This targeted check is not a complete accessibility conformance audit.

## Evidence

Browser snapshots and console logs are in `.playwright-cli/`. Review images are in `output/playwright/`:

- `desktop-revised.png` and `tablet-revised.png`: revised desktop and tablet layout.
- `mobile-fit-final.png`: narrow comparison framing after camera fitting.
- `presentation-revised.png`: classroom presentation layout.
- `webkit-desktop.png` and `webkit-particles.png`: WebKit smoke review.
- `states-of-matter-final.png`: final production 3D particle view after the fallback and readability fixes.
- `matterlab-desktop.png` and `matterlab-mobile.png`: screenshots from the final actual-3D browser test run.

Earlier images ending in `review.png` record construction findings and are not approved final screenshots. They are retained to make the fixes traceable.

## Verification limits

- Performance on representative school Chromebooks, actual classroom projection and school network load times have not been measured. A 60 Hz simulation/rendering design is not proof of a sustained device frame rate.
- Ordinary Chrome and WebKit review logged Three.js dependency deprecation warnings for Clock and the soft shadow map. No normal-use console errors remained in the tested flows.
- The initial app is a local preview. External hosting, offline caching and later term simulations are outside this stage.
- Particle motion, visual scale and apparatus are simplified teaching models. The thermal model uses ideal pure-water phase transitions at fixed pressure. It is not molecular dynamics, calibrated fluid dynamics or a complete water-cycle simulation.
- Full 4.1.1 coverage remains pending the later water-cycle scene. The current scene explicitly labels that coverage as partial.

## Final checkpoint

Complete: production build, ten model and route tests, eight browser flows, actual production 3D inspection, responsive screenshots and live preview HTTP 200. Final bundle: `index-CzYWyWPC.js` (332.76 kB gzip) and `index-vtbnX17A.css` (9.04 kB gzip). Preview is served locally at http://127.0.0.1:5199/.

User review of the prototype remains the gate before expanding to later scenes. No external deployment was performed.
