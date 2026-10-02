# Controls and accessibility

## Navigation

The default `/` and `/#/` entries open the syllabus menu, grouped as **4.1 Properties of matter**, **4.2 Properties of water**, **4.3 Solutions**, **4.4 Separating mixtures**, and **4.5 Context**. The menu shows all nineteen exact supplied outcome statements in order and has direct activity links. Outcome 4.1.1 offers both the Water cycle and States comparison. Choose one activity or combine linked activities; the page assigns no lesson pacing or completion state. The persistent **Menu** link and brand return from every lesson. Lesson shells also provide previous/next outcome links in syllabus order.

The lesson header retains quick links for Water, Matter, Solutions, Mixtures and Water pollution. When Matter is active, a compact sub-navigation keeps States, Change Station, Plasma and Bose–Einstein examples reachable. The last two remain optional atomic examples and do not appear as numbered outcomes. The Guide drawer continues to show the models’ assumptions and link the exact syllabus wording.

Present requests browser full-screen and retains a larger presentation layout if full-screen is unavailable. Reset restores the current lesson’s initial model conditions. Models do not store student data or require an account.

## Playback and recovery

The Water, States, Change Station, Beyond Three, Solutions, Mixtures and Pollution experiences have Play/Pause, single-step and Reset controls. Continuous playback uses bounded requestAnimationFrame timing with fixed model steps; playback-speed selections alter only playback cadence, not quantities for a fixed model-time step. Manual Step advances the duration named by the button or nearby label. Reduced-motion preference starts autoplaying models paused; manual stepping remains available.

Three-dimensional scenes support orbit and zoom where provided. Each scene has a camera reset, and States also offers front/angled/top presets, selected-chamber focus and bounded tilt. Unsupported WebGL starts in a labelled 2D equivalent; renderer failure or context loss can switch to the same live fallback. The measurement tables, trial graphs, material ledgers and controls stay usable in 2D. MatterLab loads no runtime external 3D models, textures or fonts.

## Lesson controls

- **Water cycle:** adjust sunlight, air temperature, humidity and precipitation; step the tracked reservoirs, or turn on the H₂O particle overlay. **Heating water:** choose a heater, thermometer and power; record instrument readings against model time, inspect the graph and export readings. **Water properties:** choose density, buoyancy or surface tension. **Density of liquids/objects:** select measurement tools, read instruments, calculate, and record results.
- **States:** choose one of three equal-identity water samples. Particle view starts on; Labels and qualitative Attraction can be toggled. Play/Pause, 0.08-second Step and ½×/1×/2× playback control movement. Tilt runs from −35° to +35° in 5° steps; the free liquid surface remains level relative to gravity. Front/Angle/Top, Focus, orbit, zoom and camera reset change the view.
- **Change Station:** choose melting, freezing, vaporisation, condensation, sublimation or deposition. Apply heat/cool to thermal changes or set the environmental conditions for surface transfer. The phase-mass ledger and particle markers update from the same model state.
- **Solutions:** select the solute and temperature; add measured increments, change particle size or stirring, run trials, and use tables/graphs to distinguish an observation from an equilibrium solubility result. The comparison challenge requires a seed-free supersaturated solution followed by nucleation.
- **Mixtures:** classify a sample and submit an answer; choose a mixture, physical method and trial record; alter yandying seed/chaff size, density, tilt and shaking; or select screening/flocculation/filter media and the qualitative coagulant dose. Remaining, recovered and waste masses are shown in ledgers.
- **Water pollution:** add a pollutant, set an optional hypothesis and chosen treatment, load a matched sample, run and record trials, and compare pollutant, waste and recovered-water results. Clarity is not treated as drinking-water safety.
- **Beyond Three:** vary hydrogen-plasma ionisation and electric field, or adjust rubidium-87 temperature/state fraction. Particle counts, charge ledger and field cues follow the engine state.

## Keyboard and touch

Focused lab sections support Space for play/pause and R for reset; Water also supports N for one second of model time. States adds N for one short particle step, Left/Right arrow to tilt, and Up/Down arrow to select a sample. Shortcuts ignore native inputs, selects, links and buttons so Space still activates the focused control. Sliders, selects and buttons remain native keyboard controls, and scene orbit/zoom works with touch gestures.

The Guide is a modal drawer: Escape closes it, Tab stays within it, and focus returns to the button that opened it. A Skip to simulation link moves keyboard users past the shared navigation. Reduced-motion preference is observed without removing manual controls.

## Science/source boundaries

Exact topic assumptions, data choices and sources are listed in [Water](WATER_TOPIC_MODEL.md), [Mixtures](MIXTURES_MODEL.md), [Solutions](SOLUTIONS_MODEL.md), [Pollution](POLLUTION_MODEL.md), [Transitions](TRANSITIONS_MODEL.md) and [Advanced](ADVANCED_MODEL.md). Schematic readings are identified as such. Model time is not a real-world forecast or calibration; physical filtering does not remove dissolved salt in these simplified water examples; visual clarity does not imply safety; and the Yandying values are illustrative rather than sourced cultural or botanical measurements.
