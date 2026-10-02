# MatterLab Full Term 4 Completion Brief

The user explicitly authorised completion of the entire supplied Year 7 Term 4 topic on 30 September 2026. The earlier gate requiring review before expanding beyond the first prototype is superseded. Continue through implementation, scientific review, integration and real browser verification until all nineteen outcomes below have working simulation experiences. Also complete the already requested Lexend font family and replacement of the beige palette.

This is a lesson-first interactive 3D website. Direct launch and brief teacher demonstrations remain essential. Existing States, Change Station and optional atomic extensions must remain usable. Do not turn the app into a compulsory summative course, add fake covered routes or mark a hub as outcome coverage. External publication is not requested.

## Canonical supplied outcomes

| Code | Supplied wording |
| --- | --- |
| 4.1.1 | Identify the 3 main states of matter and how they are represented in the movement of water on earth |
| 4.1.2 | Conduct an investigation to measure and graph the temperature of water to identify the changes of state as heated over time |
| 4.1.3 | Represent changes in the state of matter in terms of particle arrangement and movement |
| 4.1.4 | Compare the properties of matter in different states, including the relative strength of attractive forces between solid, liquid and gas particles, to explain differences in the behaviours of the 3 states of matter |
| 4.2.1 | Investigate the other physical properties of water, such as density, buoyancy and surface tension |
| 4.2.2 | Conduct a practical investigation and select appropriate equipment to measure the density of water and other substances, and record the results in a table to compare the calculated density with SI data |
| 4.2.3 | Determine the volume and mass of regular-shaped and irregular-shaped objects to calculate their density using the formula image |
| 4.3.1 | Investigate what substances dissolve in water and discuss findings using key terms, including soluble, insoluble, solubility, solute, solvent and solution |
| 4.3.2 | Conduct and document a practical investigation to measure solubility of different solutes in water, and present data using tables and relevant graphs |
| 4.3.3 | Qualitatively investigate the effect of temperature on solubility |
| 4.3.4 | Describe how solutions can be modelled using particle theory |
| 4.3.5 | Compare the properties of dilute, concentrated, saturated and supersaturated solutions |
| 4.4.1 | Distinguish between atoms, mixtures and compounds and explain their properties using particle theory |
| 4.4.2 | Classify matter as pure substances, including elements and compounds, and impure substances, including mixtures based on their particle composition |
| 4.4.3 | Explain how the physical properties of substances are used to separate mixtures |
| 4.4.4 | Conduct a series of practical investigations to explore common techniques to separate mixtures |
| 4.4.5 | Investigate techniques used by Aboriginal and/or Torres Strait Islander Peoples to separate mixtures |
| 4.4.6 | Investigate an industrial separation technique |
| 4.5.1 | Model how a body of water can become polluted, and plan and conduct a practical investigation that attempts to remove the pollutants |

The missing formula image in 4.2.3 is interpreted as density equals mass divided by volume. Keep the source wording in the catalogue and add the readable equation separately. Section durations other than 4.1 were not supplied; do not invent a weekly schedule. Practical outcomes need meaningful virtual equipment, measurements, controlled trials, tables and graphs where required, clearly identified as model investigations.

## Ownership and APIs

All product builders use the user-selected GPT 6 Luna with Extra high reasoning. The parent owns orchestration, this brief, source research support and independent review. Existing unrelated WaveMotion and LifeLens apps remain untouched.

Main builder `/root/luna_builder` owns font/palette, App/shared CSS/catalogue/routing/integration, and the complete mixtures group: `src/science/mixturesEngine.ts`, `src/components/MixturesLab.tsx` and `.css`, corresponding tests and science docs. It also owns final whole-app verification and the nineteen-outcome coverage matrix.

Water builder `/root/transition_builder` owns `src/science/waterTopicEngine.ts`, `src/components/WaterTopicLab.tsx` and `.css`, `tests/waterTopic.test.ts`, `tests/e2e/waterTopic.spec.ts`, and `docs/WATER_TOPIC_MODEL.md`.

Solutions and context builder `/root/advanced_builder` owns `src/science/solutionsEngine.ts`, `src/science/pollutionEngine.ts`, `src/components/SolutionsLab.tsx` and `.css`, `src/components/PollutionLab.tsx` and `.css`, corresponding unit/e2e tests, and `docs/SOLUTIONS_MODEL.md` / `docs/POLLUTION_MODEL.md`.

Do not edit another active owner's files or shared package/configuration without coordinating. All required React/Three/R3F/test dependencies already exist. Main may add the self-hosted Lexend package. Use cool-white/sky surfaces, deep ink, cobalt/aqua, and controlled coral/violet/gold science accents. No beige background or tan UI chrome. New module CSS inherits the Lexend family and shared `--toy-*` tokens; use scoped class names and modern cool fallback colours.

The feature export contracts are:

```ts
type WaterTopicMode = 'cycle' | 'heating' | 'properties' | 'density-liquids' | 'density-objects';
export function WaterTopicLab(props: { initialMode?: WaterTopicMode; onModeChange?: (mode: WaterTopicMode) => void }): React.ReactElement;

type SolutionsMode = 'dissolving' | 'investigation' | 'temperature' | 'particles' | 'comparison';
export function SolutionsLab(props: { initialMode?: SolutionsMode; onModeChange?: (mode: SolutionsMode) => void }): React.ReactElement;

export function PollutionLab(): React.ReactElement;

type MixturesMode = 'classify' | 'separate' | 'culture' | 'industrial';
export function MixturesLab(props: { initialMode?: MixturesMode; focus?: 'entities' | 'purity' | 'properties' | 'investigation'; onModeChange?: (mode: MixturesMode) => void }): React.ReactElement;
```

Export mode types from the relevant module/engine. Initial prop changes must select the corresponding experience for direct links. Components own their causal controls, play/pause, manual step, reset and graphics alternatives. Use bounded RAF playback, inert native Canvas fallback children and app-owned labels. No remote font, HDR, texture or runtime AI dependencies. Graphs and measurements belong in precise 2D DOM/SVG alongside the real 3D apparatus.

## Route and navigation contract

Each `/#/simulators/CODE` launches a purposeful initial mode, not a generic hub:

- 4.1.1 → WaterTopic cycle, linked to the existing three-state particle comparison.
- 4.1.2 → WaterTopic heating investigation.
- 4.1.3 → existing Change Station; 4.1.4 → existing States comparison.
- 4.2.1 → WaterTopic properties with density, buoyancy and surface tension accessible; 4.2.2 → density-liquids; 4.2.3 → density-objects.
- 4.3.1 to 4.3.5 → Solutions modes in order: dissolving, investigation, temperature, particles, comparison.
- 4.4.1 and 4.4.2 → classify with entities/purity focus; 4.4.3 and 4.4.4 → separate with properties/investigation focus.
- 4.4.5 → culture; 4.4.6 → industrial; 4.5.1 → PollutionLab.

Keep all existing experimental direct links working. Use five short topic groups in the main navigation or a clear lesson picker, with directly launchable outcome entries. Put the exact wording in a teacher/outcome drawer when lengthy. The first useful scientific action must remain visible; no compulsory reading, quiz or account before interaction. Advanced atomic examples remain optional in the Matter group.

## Water and matter investigations

Cycle: show a manipulable 3D landscape with water in liquid, solid and vapour reservoirs. Heating/sun, cooling/temperature and suitable weather conditions drive evaporation, condensation, precipitation and freezing/melting. Track the conserved model water across reservoirs; particles remain H2O. Clouds are droplets or ice, not visible water vapour. This is a bounded instructional cycle, not a predictive climate model.

Heating: use the verified energy/latent-heat engine and a heater-power/time model. Students select/use appropriate thermometer and heating equipment, start ice or room-temperature water, take readings, record trials and plot temperature against model time. Preserve the 0 and 100 °C ideal plateaux at the stated pressure. Speed changes playback only, not the physical clock or readings. Label accelerated model time. Provide table, readable line graph, reset and optional CSV export.

Properties: implement density, buoyancy and surface tension as distinct experiments. Buoyancy follows displaced liquid weight and average object density, including a watertight hollow shape/load example; heavy is not synonymous with sinking. Surface support is distinct from buoyancy: gentle placement, submerging/wetting and detergent affect a declared qualitative surface model. Do not invent measured force values from unsupported physics.

Density: choose an appropriate balance, ruler/regular-shape measurements, graduated cylinder and displacement. Liquid density uses tare and measured mass/volume. Regular objects use dimensions; irregular objects use displacement. Calculate mass/volume, reject invalid or zero volume, show correct conversions between g/mL or g/cm³ and kg/m³, and record a comparison table with sourced reference densities and reference conditions. Students must perform measurement actions, not receive an automatic answer as the only interaction.

Primary water sources: USGS water properties/density/surface tension and ACS Middle School Chemistry density and state-change lessons. Sources and numerical reference conditions must be documented.

## Solutions

Provide multiple soluble substances and an insoluble example, using the exact vocabulary in context. Keep solvent quantity, added solute, dissolved solute and undissolved/crystallised mass separate. Preserve mass and constituent identities; ionic salts dissociate into appropriate ions, not intact fictional NaCl molecules. Water remains H2O.

Stirring/particle size affect dissolution rate; equilibrium capacity depends on the selected substance and temperature. Use attributable solubility data or explicitly declared illustrative curves, with suitable substance-dependent temperature responses. Do not universally equate hotter with more soluble.

The solubility investigation supports fixed solvent quantity, measured additions and undissolved residue, multiple trials, a table and relevant graph. An unsaturated or still-dissolving observation supplies a lower bound or dissolved amount, not the measured equilibrium solubility. Valid solubility measurements require appropriate equilibrium/excess-solid conditions.

Compare dilute and concentrated as relative descriptions of matched samples. Concentrated does not imply saturated. Saturation concerns the selected solute's capacity at the current temperature. Supersaturation is metastable: prepare a suitable hot fully dissolved solution, cool it without seeds and then trigger crystallisation. Existing undissolved crystals or new grains act as nucleation sites. The resulting solids are solute crystals, not frozen water. Show numerical and particle-view consequences, and meaningful replayable challenges.

Start sources: https://www.acs.org/middleschoolchemistry/lessonplans/chapter5.html and its temperature/dissolving lessons. Verify numerical solubility curves against primary manufacturer/research/authoritative published references before presenting them as reference data.

## Mixtures, separation and context

Classifier: distinguish particle entities (atoms, molecules, ions where used) from classifications (element, compound, mixture). Include a molecular element such as O2, a monatomic element such as Ar, a compound such as H2O and mixtures of substances. Combining intact sample populations changes composition; physically mixing atoms must not silently create chemical bonds. Empty samples are not correctly scored as a pure substance.

Separation: provide sieving, magnetic separation, settling/decanting, filtration, evaporation and distillation where suitable. The material properties drive real transfer rules and determine what is retained, passes through or recovered. Ordinary filtration cannot remove dissolved salt. Evaporation can recover nonvolatile solute; distillation can recover condensed solvent. Preserve each constituent across feed, recovered outputs, residue and declared losses. Let students construct/revise sequences and document multiple investigations, with state-based feedback and explanations of the relevant physical property.

Cultural investigation: implement a documented separation mechanism and a source exploration, using public educational material and named cultural context. ACARA's published Year 7 background describes yandying, the word used by Yindjibarni people of the Pilbara, and a specific double-yandying mulga-seed example of Yankunytjatjara people in north-western South Australia. Do not conflate the word origin with exclusive ownership of the technique. The generic unadorned dish's tilt/shake and particle size/density must affect segregation; sources and comparison questions support investigation. Do not invent stories, motifs, secret practices or claim community endorsement. Parent performs an attribution/content review of the published educational account. This authorised source-grounded educational treatment can complete 4.4.5 without contacting people or manufacturing permission.

Source: https://www.australiancurriculum.edu.au/support-resources/background-information/science_teacher_background_information_AC9S7U06_E6

Industrial investigation: use a real documented Sydney Water filtration process. Screening, floc formation and filter media have meaningful controls and performance readouts. Distinguish chemical coagulation and disinfection from physical separation. Explain feed, outputs, waste and maintenance at a Year 7 level; no unsupported drinking-safety certification. Source: https://www.sydneywater.com.au/education/drinking-water/water-quality-filtration.html and its linked filtration resource.

## Pollution investigation

Model a 3D water body acquiring floating oil/litter, suspended sediment and a dissolved pollutant such as salt. Input controls change a conserved pollutant ledger; processes do not silently erase material. Students plan a removal investigation, select variables/controls, collect comparable before/after trials and plot a relevant result.

Skimming, settling/decanting, filtering and a suitable solvent-recovery process have different effects for different pollutant classes. Simple filtering leaves dissolved salt behind. Track remaining pollutant mass, recovered water and waste; clarity must be separate from dissolved contamination. Never equate clear-looking model water with safe drinking water. A source-grounded statement of unmodelled hazards is appropriate. Use matched initial samples for controlled trial comparisons, not arbitrary changing starting conditions.

## Completion and review

Each builder reports API-ready status early so integration can proceed, then finishes meaningful invariants, actual controls and module browser checks. Coordinate port 5197 runs to avoid collisions; use the existing private dev preview for screenshots. No dummy modules or static explanatory cards count as simulations.

Main integrates nineteen canonical routes and updates exact outcome coverage, control inventory, sources, font/asset provenance and handover docs. Include a teacher coverage view with the actual simulation/activity mapped to every outcome. Parent independently reruns build and appropriate tests, launches every outcome, checks the actual scientific behaviours and investigation outputs, reviews cultural attribution and industrial process accuracy, and inspects desktop/mobile/graphics-fallback views. Completion means all nineteen functional requirements are handled, not merely that tests or routes exist.

Keep the local production preview on 5199. Preserve reproducible sources and review evidence. Do not publish externally, commit Git changes or alter unrelated projects unless separately requested.
