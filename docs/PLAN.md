# Year 7 Matter 3D Simulator Plan

Approved plan, 30 September 2026. App name: MatterLab 3D. The initial States prototype and the subsequently authorised playful redesign, six-transition section and plasma/BEC extensions are built and independently verified. The other Term 4 topics remain future work. See `INDEPENDENT_PLAYGROUND_REVIEW.md` for the latest verification and its limits; `INDEPENDENT_REVIEW.md` preserves the first prototype review.

MatterLab is a collection of polished interactive simulations for ordinary Year 7 Term 4 lessons. A teacher can open the relevant concept, demonstrate it in two to five minutes, and let students investigate further. Every simulation is directly accessible. The interactive scene opens before optional explanations, data collection or games.

This document defines the product and builder handover. GPT 6.1 Sol is the planner, orchestrator and reviewer; GPT 6 Luna with Extra high reasoning built Stage 1 following the user's implementation approval. The first deliverable is the completed local States of Matter prototype, reviewed before expanding the collection. External deployment has not started.

## Classroom experience

The home screen has five topic groups matching the supplied syllabus: Properties of matter, Properties of water, Solutions, Separating mixtures, and Solutions and mixtures in context. Each group contains clearly named simulation tiles and direct outcome links. A teacher can launch a particular outcome mode without opening a topic hub first.

The main scene occupies roughly three quarters of a desktop presentation screen. A compact control rail holds the current actions. The title, one sentence objective and state labels remain visible. Optional help opens in a drawer. Graphs and readings sit next to the relevant apparatus, rather than replacing it.

Three uses share the same scientific engine:

- Demonstrate: clean initial scene, presentation controls, useful comparison presets and large labels.
- Explore: the full set of relevant variables and optional measurement tools.
- Try a challenge: a short optional task scored from the scientific state and decisions.

Demonstrate is the default. There are no unlocks, compulsory quizzes, accounts or prerequisite activities. Modes do not change the underlying science. Saved links include the outcome and a validated preset, so a teacher can prepare a demonstration in advance.

## Visual direction and interaction

Use a bright, contemporary science studio: pale neutral surfaces, deep navy type, restrained blue and teal accents, warm highlights and generous negative space. Apparatus has recognisable forms, convincing materials, soft contact shadows and carefully framed lighting. Particles have readable depth and silhouettes. Avoid excessive glow, reflective clutter and text embedded in textures.

Use genuine WebGL 3D for containers, particle volumes, equipment, objects and landscapes. Use precise HTML or SVG for graphs, tables and equations. Graphs are read as measurements, not perspective objects.

Camera interaction supports mouse and touch orbit, zoom and a reset view button. Front, top and angled camera presets help teachers recover a useful view quickly. No free walking is required. Equipment can be manipulated directly where useful, with equivalent labelled buttons and keyboard actions.

Shared controls: pause or play, single step, speed, reset experiment, reset view, labels, particle view where meaningful, full screen and graphics quality. Reset experiment restores variables and measurements; reset view restores only the camera. Changing a camera or animation speed never changes scientific results. Separate model time from playback speed.

Controls have visible limits, current values and units. Pouring, heating and mixing produce responsive consequences. Loading, disabled actions, invalid measurements, empty containers, recovery and completion are deliberately designed. Audio is optional and off initially.

## Simulation collection and outcome coverage

The nineteen supplied outcomes map to twelve reusable scenes. Each outcome has its own direct entry mode, objective and appropriate default state even where scenes share an engine.

| Scene | Outcomes | Brief demonstration | Deeper interaction and optional challenge |
| --- | --- | --- | --- |
| States of Matter | 4.1.1, 4.1.3, 4.1.4 | Compare solid, liquid and gas water with linked visible and particle views | Tilt containers, vary heating or cooling, compare particle movement and arrangement; predict a hidden state |
| Water on Earth | 4.1.1 | Change heating or cooling in a compact landscape and trace water between reservoirs | Track a parcel through evaporation, condensation, precipitation and freezing; choose conditions for a specified transition |
| Heating and Cooling Water | 4.1.2, 4.1.3 | Heat ice while a temperature graph develops | Select equipment, record readings, compare heating power and explain changes of state |
| Float or Sink | 4.2.1 | Drop objects into water and compare outcomes | Vary mass, volume, material, liquid density and hollow shape; design a boat to carry a load |
| Density Bench | 4.2.2, 4.2.3 | Weigh an irregular object and measure displaced volume | Choose equipment, measure solids and liquids, calculate density and compare reference values |
| Surface Tension | 4.2.1 | Place a needle carefully, then add detergent | Compare placement and surface conditions; explain support at the surface rather than treating it as ordinary buoyancy |
| Dissolving Bench | 4.3.1, 4.3.2, 4.3.4 | Add salt or sand and inspect both visible and particle views | Compare solutes using fixed water quantity, record mass dissolved and graph measured solubility |
| Concentration and Crystals | 4.3.3, 4.3.5 | Add solute to saturation, then alter temperature | Compare concentration and saturation; prepare a suitable supersaturated solution and trigger crystallisation |
| Particle Classifier | 4.4.1, 4.4.2 | Compare an element, a compound and a mixture | Select or combine sample populations and classify their composition; explain an unfamiliar sample |
| Separation Bench | 4.4.3, 4.4.4 | Filter sand and salt water and examine what passes through | Assemble sieving, magnetic separation, settling, decanting, filtration, evaporation or distillation; recover chosen components |
| Separation in Context | 4.4.5, 4.4.6 | Explore a sourced cultural process or an industrial separation stage | Context specific apparatus and causal controls; compare which physical properties enable separation |
| Polluted Water | 4.5.1 | Filter a polluted sample and inspect remaining pollutants | Add pollutants, plan a controlled investigation, build treatments, measure removal and revise the plan |

The context scene contains two separately launchable experiences. Cultural content needs its own researched model and review; an industrial animation cannot stand in for 4.4.5.

The provided outcome codes and wording are the curriculum authority for this project. Durations for sections 4.2 to 4.5 remain unspecified; do not invent a weekly schedule. In 4.2.3 the missing formula image is interpreted as density equals mass divided by volume. Preserve the supplied wording in the outcome catalogue and add the readable formula separately. Reference comparisons include kg/m³ and age appropriate g/cm³ or g/mL with explicit conversion.

## First build specification for States of Matter

### Initial screen

Open straight to three aligned transparent chambers labelled Solid, Liquid and Gas. Use the same substance, water, and the same represented particle count in each model. Show ice, liquid water and water vapour in everyday view, with particle view immediately available. The gas chamber has a much larger representative volume; illustrative particle sizes and spacing are explicitly identified as schematic. Do not force gas and liquid into equal physical volumes merely to fit a comparison.

Initial comparison uses specified presets representing different thermal conditions, rather than claiming all three samples are stable at the same temperature and pressure. Students can rotate the linked camera and immediately observe solid particle vibration, liquid rearrangement and gas movement. Molecular models remain intact through changes of state.

### Primary interactions

1. Toggle particle view. Retain the chamber framing so students can connect representations.
2. Pause, then single step. Solid particles still have motion across steps.
3. Tilt the apparatus through a bounded angle. Solid retains shape; liquid redistributes with a level surface relative to gravity; gas remains distributed through the available chamber.
4. Select a chamber for a larger view. Camera presets and reset prevent disorientation.
5. Open Transform mode. Add or remove thermal energy to a sample, with a thermal state model controlling temperature and phase fractions. Fixed ambient pressure and model assumptions are visible on demand.
6. Turn on attraction cues. Use qualitative interaction indicators with explanatory labels, not molecular bonds that suggest melting breaks water molecules. These are explanatory overlays, not calibrated force measurements.

Use physically meaningful state models, with simplified fluid geometry and representative particle motion. Photorealistic computational fluid dynamics and molecular dynamics are outside the proposed scope. Predefined mesh morphs may render an engine state; they must never decide phase, density or success independently of that state.

### Two minute demonstration

Teacher opens the comparison, selects particle view and asks whether a solid's particles move. Pause and single step to reveal vibration. Tilt the chambers to compare shape and flow. Show gas filling its chamber. Reset. All of this is available without reading instructions or completing a task.

### Optional challenge

Offer three short tasks: identify a state from movement and arrangement, predict behaviour on tilting, and achieve a requested change of state using thermal controls. Feedback refers to the relevant engine state and the student's prediction. No speed leaderboard. Variants use seeded starting conditions and work with keyboard and reduced motion.

### Acceptance criteria

- The initial useful action is visible at classroom laptop and tablet sizes.
- Containers, materials, lighting and particle motion look coherent from front, top and angled views.
- Solid vibration, liquid rearrangement and gas movement are distinct and remain legible on a projector.
- Particle count and molecular identity are conserved through phase changes.
- Heating and cooling recompute temperature and phase from energy state; pause and camera controls leave the science unchanged.
- Comparison presets clearly differ in thermal conditions. Transform mode handles mixed phases coherently.
- Ice's lower density than liquid water is represented consistently rather than applying a generic solid packing rule to water.
- Gas is not depicted as visible white steam. Any condensation cloud is labelled liquid droplets.
- Every visible control works, including reset, single step, view switching and touch manipulation.
- The same objective and challenge can be completed with keyboard controls and a text or 2D equivalent.
- Reduced motion and graphics settings preserve outcomes; WebGL failure produces a usable alternative.
- Sol reviews the actual browser build, screenshots and checks. User review of this first experience precedes expansion.

## Scientific model contracts

Engines must be independent of React and rendering. Store authoritative quantities once, derive readings and visuals from them, and use deterministic updates or seeded variation. Clamp valid ranges and reject invalid actions explicitly. Units, assumptions, reference conditions and numerical tolerances belong in the science contract.

### States and thermal change

Solid particles vibrate rather than freeze motionless. Liquid particles remain close while rearranging. Gas particles move through widely spaced representative positions. Particle size does not expand on heating. Relative attraction is presented in the context of arrangement and thermal motion, without implying that molecular identity changes between phases.

The thermal engine uses mass, energy input, heat capacity and latent heat. At approximately standard atmospheric pressure, pure water has melting and boiling transitions near 0 °C and 100 °C. Ideal phase change plateaux must be explained as a model: real measurements depend on conditions and apparatus. ACS provides background on energy input during these transitions: [Changing state teacher background](https://www.acs.org/content/dam/acsorg/msc/downloads/chapter-2/lesson-5/ch2-l5-teacher-background.pdf).

Offer ideal readings first and an optional measurement mode with bounded, seeded instrument uncertainty. Animation playback speed cannot change the collected time or temperature data. Evaporation occurs below boiling and is distinguished from bulk boiling. Water cycle modelling conserves the tracked water quantity across reservoirs, with simple prescribed weather conditions rather than an implied predictive climate model.

### Density and buoyancy

Use density = mass / volume and displaced liquid weight for buoyancy. Model whole objects, including hollow volume and maximum displacement. An object does not float merely because it is light. A solid object's average density and the liquid density control fully submerged behaviour; shape affects how much water a hollow object can displace before flooding.

Mass and displaced volume remain conserved when changing object shape. Invalid measurements, submerged hollow objects, partial immersion and overflow need defined handling. Balances include tare. Graduated cylinder readings include meniscus guidance and finite resolution. Reference densities have temperature and unit metadata; students compare with appropriate tolerance rather than exact rounded equality.

### Surface tension

Use a clearly identified qualitative surface model driven by object geometry, placement and surface condition. A gently placed dense needle can be supported by the surface; a submerged needle does not gain the same support. Detergent changes the model's surface tension parameter. Do not present arbitrary scores as measured newtons. Source the chosen behaviour before implementing calibrated numerical forces.

### Solutions

Keep water quantity, solute added, solute dissolved and undissolved mass separate. Solubility capacity depends on the selected substance and temperature using attributed data. Stirring and particle size can affect rate without changing the equilibrium capacity in the selected model. Some substances have weak or different temperature responses, so no universal hotter means more soluble rule.

Dilute and concentrated are relative descriptions within a defined comparison. Saturation concerns the solubility limit at a stated temperature. A concentrated solution need not be saturated. Supersaturation is a metastable condition above equilibrium capacity, possible for a suitable solute and preparation sequence; seed or disturbance triggers crystallisation. Solute mass remains conserved.

Choose solutes and particle representations together. An introductory schematic may use labelled solute entities, but do not depict ionic salts as intact molecules or imply all substances dissolve identically. State that dissolving disperses material; it does not make it vanish. ACS resources are a research starting point: [Water and dissolving lessons](https://www.acs.org/middleschoolchemistry/lessonplans/chapter5.html).

### Classification and separation

Distinguish atoms and molecules as entities from elements, compounds and mixtures as substance classifications. Elements can include molecules made of one element. Compounds have chemically bonded constituent elements; a mixture is not defined by particles simply touching. Separation preserves component identities and mass under the stated physical model.

Represent filter pore size and suspended particle size. Ordinary classroom filtration does not remove dissolved salt. Evaporation recovers a dissolved nonvolatile solid; distillation can recover condensed solvent. Material leaving an open apparatus remains accounted for as an output or loss. Mixtures should have documented component properties and separation rules rather than preset method success animations.

The industrial proposal is a water treatment train with configurable stages and measurable suspended solids removal. Identify stages whose real operation also involves chemicals or biology; do not imply physical filtration alone makes water potable.

### Cultural separation

Research a named community, location, technique and source before choosing apparatus, narration or interaction. The Australian Curriculum background identifies examples including yandying and winnowing: [First Nations separation background](https://www.australiancurriculum.edu.au/support-resources/background-information/science_teacher_background_information_AC9S7U06_E6). This is a starting source, not community endorsement or permission for adapted cultural imagery.

Prioritise Indigenous authored or community supported sources and an appropriate content review. Do not invent stories, motifs, ceremony or a generic Indigenous setting. If suitable evidence or review is unavailable, record 4.4.5 as pending and expose that status honestly in the teacher coverage view. It remains required for complete unit coverage.

### Pollution investigation

Track each pollutant separately as floating, suspended or dissolved material. Model treatment efficiencies for specified pollutant classes, supported by sources and labelled assumptions. Turbidity or clarity cannot prove biological or chemical safety. Compare matched initial samples, treatment steps, remaining pollutant mass, water recovery and waste. Support student planning, measurement and revision without claiming virtual work replaces a required physical practical.

## Architecture and delivery proposal

Create a separate app at `MatterLab/` inside the current Science Simulators workspace. Existing WaveMotion and LifeLens applications are context, not source code to replace. Their inspected documentation supports direct simulation entry, accessible scientific models and static delivery. The parent shared specification referenced by the WaveMotion README was not found at its documented path; this plan does not assume its unseen requirements.

Proposed stack: React, TypeScript and Vite; Three.js through React Three Fiber for 3D; lightweight DOM or SVG measurement surfaces; Vitest for engine tests and Playwright for browser verification. Resolve stable mutually compatible versions at implementation time and lock them. No backend is needed for the proposed core experiences.

Use instanced particle meshes, bounded particle populations, lazy scene loading and adaptive visual quality. Pause unnecessary rendering when a scene is inactive or static, while preserving deliberate motion in active scenes. React Three Fiber documents instancing and on demand rendering as performance techniques: [Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

Suggested structure:

- `src/content/`: exact outcomes, scene registry, presets, glossary, sources and model limits.
- `src/science/`: thermal, particles, density, buoyancy, solutions, separation and pollution engines.
- `src/scenes/`: 3D scene composition and apparatus.
- `src/components/`: shared toolbar, measurement tools, presentation layout and accessible alternatives.
- `src/challenges/`: state based task generation, feedback and scoring.
- `tests/`: invariants, control effects, routes, keyboard, fallback and browser checks.
- `docs/`: coverage matrix, science review, controls inventory, asset provenance and stage evidence.

Use static host compatible direct links, provisionally hash routes such as `/#/simulators/4.1.4`. Each outcome entry specifies the scene and mode. An outcome map validator checks all nineteen outcomes, including pending statuses. Full screen can hide navigation but leaves essential labels and reset accessible.

Keep fonts, assets and dependencies local at runtime. No login, student names, analytics or runtime AI calls. Optional preferences and anonymous progress stay on the device, with a clear reset action. Add an offline cache after the scene architecture is stable; state what has been downloaded and do not promise uncached scenes offline. Deployment destination will be confirmed after a tested local preview is accepted.

## Performance and access targets

These are proposed acceptance targets, not measured results. Record actual hardware, browser, viewport, graphics level and test conditions with evidence.

- Aim for 60 frames per second on the teacher laptop and at least 30 on a representative school device after adaptive quality adjustment.
- Target useful first interaction within three seconds on a warm local load and five seconds under a documented representative school connection. Measure cold and cached loads separately.
- Initial app plus first scene compressed transfer target: at most 5 MB; lazy load other scenes. Revisit with evidence if the first build cannot meet this without degrading teaching value.
- Default classroom checks at 1366 × 768, tablet checks at 1024 × 768, responsive checks at 375 pixels wide and 200 percent zoom.
- Readable projection labels, strong contrast, visible focus and touch targets around 44 pixels.
- Complete keyboard operation, manual stepping for reduced motion and equivalent text or 2D scientific feedback.
- Test WebGL unavailable and context loss, blocked storage and offline reload. Provide recovery with retained learning function.
- No dependence on colour, sound, drag gestures or camera precision for success.

## Build stages and review gates

| Stage | Luna deliverable | Sol verification and gate |
| --- | --- | --- |
| 0 Planning | No implementation during this stage | Review this plan; lock scope and first scene brief |
| 1 States of Matter | Separate runnable app, polished scene, real engine, direct outcome modes, optional challenge and alternatives | Inspect browser, scientific invariants, control behaviour, camera angles, projection layout and performance; present the actual build for user review before expanding |
| 2 Matter and Water | Water on Earth, Heating and Cooling, Float or Sink, Density Bench and Surface Tension | Review thermal behaviour, measurement workflow, units, buoyancy, surface model and meaningful challenges |
| 3 Solutions | Dissolving Bench and Concentration and Crystals | Review rate versus capacity, data provenance, particle representation, conservation and metastability |
| 4 Mixtures | Particle Classifier, Separation Bench and industrial context | Review classification edge cases, apparatus behaviour and component accounting; cultural experience proceeds only with adequate sourced content and review |
| 5 Context and release | Polluted Water, completed cultural experience, final visual consistency and offline packaging | Audit all nineteen outcomes, browser access, graphics fallback, science, performance and coverage; obtain final publication decision |

A stage is complete only with a working preview and evidence. A builder's status report is not proof. Sol checks the submitted build independently and sends scoped corrections back to Luna. Do not expand a stage while its scientific or interaction defects remain unresolved.

## Builder handover

Sol delegates one bounded stage at a time to GPT 6 Luna with Extra high reasoning. Use the actual available model identifier and supported reasoning setting; do not silently substitute a model. Stage 1 was delegated using `gpt-6-luna` with `xhigh` reasoning and is complete. Later stages await review of the first prototype.

Each brief includes the outcome modes, default scene, allowed actions, engine contract, visual direction, known misconceptions, accessibility alternative, acceptance criteria and explicit exclusions. The first brief is Stage 1 only. It must not scaffold all remaining scenes as empty pages or represent placeholder routes as covered outcomes.

For every stage Luna returns: runnable source, launch instructions, changed files, source and asset provenance, model limitations, checks actually performed, screenshots at agreed viewports and a concise list of remaining issues. Sol can continue review and corrections under the authorised stage scope. User review is focused on the concrete experience and classroom suitability.

## Review decision

The completed first build is the States of Matter scene and its three direct outcome modes, with the shared shell kept minimal. Its visual and interaction quality will be reviewed as the standard for later scenes. The connected catchment challenge is a later optional experience, never the entry point for an ordinary lesson.

Open choices for review are the working name and visual direction. Representative school hardware and hosting can be confirmed during implementation; they do not prevent finishing this plan. The complete unit still requires sourced cultural content and tested measurement investigations, alongside the brief classroom demonstrations.
