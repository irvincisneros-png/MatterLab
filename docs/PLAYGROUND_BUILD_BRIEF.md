# MatterLab Playground Revision Build Brief

Authorised by the user on 30 September 2026 after reviewing the first prototype. Scope: a substantial Apple and Nintendo inspired redesign, two advanced matter experiments, and a dedicated section for changes of state. This does not authorise building the other term topics or publishing externally.

## Product direction

The current app looks clinical. Make the revision feel like an original, beautifully made science toy: clear typography and calm composition, warm cream surfaces, vivid restrained colour, rounded apparatus, tactile large controls, gentle responsive motion, and meaningful playful feedback. The 3D world must dominate. Do not merely recolour the existing administrative cards. Remove unnecessary chrome and keep explanations on demand.

Use an original design, without Apple or Nintendo logos, characters or copied interfaces. Code-made models and local assets are preferred. No runtime CDN, external font, HDR preset or generative API dependencies. Avoid Drei Text default remote fonts and effectful Canvas fallback children.

Design tokens agreed between builders: `--toy-paper` cream, `--toy-ink` dark navy, `--toy-blue` ice blue, `--toy-teal` turquoise, `--toy-yellow` sunny gold, `--toy-coral` warm coral and `--toy-violet` purple. Exact colours belong to the main design builder. Child workspaces may provide fallback token values. Primary descriptions should be at least 14 to 16 px with strong contrast; principal interaction targets about 44 px. Secondary apparatus detail must not force tiny teaching text.

Core water states stay directly accessible and immediately interactive. Advanced states are optional and never locked. Suggested primary sections: States, Change Station, Beyond Three. Existing direct outcome routes remain supported. Outcome 4.1.1 remains partial until an Earth water-cycle scene is built. Do not advertise the entire unit as complete.

## Work ownership and integration

All delegated builders use GPT 6 Luna with Extra high reasoning. Parent Sol owns this brief, orchestration and independent review.

- Main design builder owns `src/App.tsx`, `src/styles.css`, `src/components/MatterScene.tsx`, routing, shared scene styling, general integration, existing e2e tests and the final build. Preserve or improve the existing science engine invariants. It may coordinate with the two feature builders but must not overwrite their files.
- Transition builder owns `src/science/transitionEngine.ts`, `src/components/ChangeLab.tsx`, `src/components/ChangeLab.css`, `tests/transitions.test.ts`, `tests/e2e/transitions.spec.ts` and `docs/TRANSITIONS_MODEL.md`.
- Advanced builder owns `src/science/advancedMatterEngine.ts`, `src/components/AdvancedLab.tsx`, `src/components/AdvancedLab.css`, `tests/advancedMatter.test.ts`, `tests/e2e/advancedMatter.spec.ts` and `docs/ADVANCED_MODEL.md`.

Do not change package dependencies or shared configuration without coordinating with the main builder. Existing React, TypeScript, Three.js, R3F, Drei, Vitest and Playwright dependencies are available. Keep unrelated WaveMotion and LifeLens files unchanged. Do not commit or publish.

Feature components export these APIs so integration does not depend on waiting for file discovery:

```ts
type TransitionId = 'melting' | 'freezing' | 'vaporisation' | 'condensation' | 'sublimation' | 'deposition';
export function ChangeLab(props: {
  initialTransition?: TransitionId;
  onTransitionChange?: (id: TransitionId) => void;
}): React.ReactElement;

type AdvancedExperiment = 'plasma' | 'bec';
export function AdvancedLab(props: {
  initialExperiment?: AdvancedExperiment;
  onExperimentChange?: (id: AdvancedExperiment) => void;
}): React.ReactElement;
```

Types may be exported from each engine. Child components own their state, play/pause/step/reset and controls. Respond to changes in the initial-selection prop for hash navigation. Each module gets a real 3D scene plus a usable 2D or text equivalent, reduced-motion behaviour and graphics-failure recovery. Use app-owned DOM labels rather than Html portals inside the Canvas. An inert `Canvas fallback` child must never run an effect that signals graphics failure.

Suggested new direct routes: `/#/changes/melting` and other transition IDs, `/#/advanced/plasma`, `/#/advanced/bec`. Main routing maps `/#/simulators/4.1.3` to Change Station while preserving the other supplied outcome entries. Old interfaces can be refactored; tests should verify final learning behaviour rather than preserve obsolete chrome.

## Change Station science and experience

The student selects a transition, predicts the direction, manipulates an actual causal condition and observes the sample and particle view. Clicking a transition prepares a scenario; it does not replace the scientific model with a prerecorded success reveal.

- Melting: solid to liquid, driven by heating. Reuse the verified water thermal engine and latent-heat plateau.
- Freezing: liquid to solid, driven by cooling. Phase fractions must follow energy, with a 0 °C ideal plateau.
- Vaporisation: liquid to gas. Include distinct evaporation below boiling and boiling scenarios. Evaporation is a surface process, boiling involves the liquid bulk. Do not draw water vapour as white smoke.
- Condensation: vapour to liquid, driven by cooling or a suitable cooled surface. Represent growing liquid droplets as droplets, not gaseous molecules.
- Sublimation: ice to vapour without liquid, such as ice exposed to dry air below freezing. A below-triple-point equilibrium route is also possible, but do not require low total atmospheric pressure for all natural sublimation.
- Deposition: vapour to ice without liquid, such as frost on a cold surface under suitable vapour conditions.

Separate the equilibrium thermal model from an explicitly qualitative surface-transfer model. For evaporation, sublimation and deposition, temperature and humidity can causally affect the transfer; state that accelerated rates are illustrative rather than calibrated predictions. Environmental heating or cooling can maintain a set surface temperature while mass transfers. Keep a conserved water ledger across solid, liquid and vapour reservoirs, with fractions nonnegative and total mass constant. The represented water molecules remain H2O through all six transitions.

Suggested controls: large Heat and Cool actions or a meaningful heating-power dial, play/pause/step, particle view, one or two relevant environmental controls per scenario, clear current temperature and fractions, reset and a short optional prediction challenge. Expose energy in kJ through optional detail rather than making an unfamiliar unit the only usable control. The default scene should look like playful apparatus, not a state chart with a decorative animation.

Source starting points:

- USGS sublimation and deposition: https://www.usgs.gov/water-science-school/science/sublimation-and-water-cycle?page=1
- USGS evaporation: https://www.usgs.gov/water-science-school/science/evaporation-and-water-cycle
- Existing water model and ACS energy sources in `docs/SCIENCE_MODEL.md`.

## Advanced experiments science and experience

These are two additional examples, not a claim that there are exactly five possible states of matter. Use separate atomic-gas models, with a visible substance label. They are not further states produced by manipulating intact water molecules in the core lab.

### Plasma

Use a simplified hydrogen atomic gas. Increasing an explicitly illustrative energy input ionises some atoms into positive ions and free electrons. Preserve nucleus count and total electron count; net charge is zero in the complete sample. Free electrons plus bound electrons equal the original electron population.

An electric-field control makes positive and negative particles respond in opposite directions. Neutral atoms do not acquire a charged drift. Field reversal must reverse the corresponding response. Particle trajectories and glow are schematic rather than a calibrated plasma simulation. Clearly identify charges through labels and counts, not colour alone. Recombination when energy is reduced should conserve the same constituents.

The visual target is an expressive coral and violet chamber with recognisable charged particles and field cues. Core meaning comes from the model and manipulation, not decorative lightning. Suggested challenge: create an ionised sample and use/reverse the field to compare charges.

DOE source: https://www.energy.gov/science/doe-explainsplasma

### Bose Einstein condensate

Use a trapped rubidium-87 atomic gas and a bounded temperature control expressed in nanokelvins, always above 0 K. Explain that a nanokelvin is one billionth of a kelvin. Below the chosen model's critical temperature, show an increasing shared quantum-state component with a wave or density representation. Atoms remain atoms; they do not chemically fuse into one new atom, become an ordinary ice cube or become entirely motionless.

The NIST experiment observed onset near 180 nK for its particular trap and density. If using this as an illustrative preset, identify it as a preset inspired by that experiment, not a universal threshold. If choosing an ideal-trap condensate-fraction formula, document its assumptions and source. Otherwise explicitly identify the fraction as an illustrative qualitative mapping rather than a measurement or full quantum solution.

The visual target is a violet ultracold trap with warm atomic-cloud and cold shared-wave representations, a satisfying cooling interaction, and accessible state/count/temperature information. Suggested challenge: produce a shared-state component, then warm it and explain the reversal. Conserve atom number and keep both condensed and thermal fractions valid.

NIST sources:

- https://www.nist.gov/publications/observation-bose-einstein-condensation-dilute-atomic-vapor-below-200-nanokelvins-0
- https://www.nist.gov/programs-projects/spinor-condensates-and-ultracold-collisions

## Verification and handover

Each feature builder must provide runnable components, source/model limits, meaningful engine invariants, keyboard and fallback checks, and a concise integration message. Run component-specific unit tests during construction; coordinate full e2e runs after integration.

The main builder integrates all three sections and runs build, unit and browser checks. Supported WebGL must remain genuinely 3D after startup and control/view changes; tests must independently probe graphics availability rather than accepting any fallback as success. Reset, pause, single step, routes and optional challenges must operate consistently. Check 1366 by 768, 1024 by 768, 375 pixel width and presentation mode.

Parent independently inspects the actual production build, visual quality, causal scientific behaviour and check results. The previous source and production build are preserved in `.work/matterlab-before-playground-20260930/source-and-build.tar.gz` at the workspace root. Keep the current production preview on 5199; use a separate dev server until the integrated build is verified. No external publishing is authorised.
