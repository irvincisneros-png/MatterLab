# Mixtures, classification and separation model

Mixtures Lab contains four modes: particle classification, physical separation, a source-grounded yandying investigation and a simplified industrial filtration sequence. The route's `focus` prop chooses the opening: `entities` (4.4.1) an atoms · molecules · ions comparison; `purity` (4.4.2) a sort-every-sample task with a score tally; `properties` (4.4.3) free choice of separation property; `investigation` on the separate mode (4.4.4) a guided iron + sand + salt challenge. None of these is a compulsory quiz: the 3D model is usable immediately. Its particle markers are schematic representatives, not a count of real atoms in a classroom sample.

## Particle composition

The classifier keys its result to the number of different chemical substances present:

- One element substance is an element. Oxygen is represented as bonded O₂ molecules; argon as individual Ar atoms. A carbon-dioxide sample shows a dark carbon centre and red oxygen atoms in one bent-free linear compound molecule.
- One compound substance is a compound. Water markers remain H₂O molecules; CO₂ has a dark carbon atom bonded to two red oxygen atoms; sodium chloride is represented by Na⁺ and Cl⁻ ions in an ionic crystal.
- Two or more substances together are a mixture. Salt water keeps separate water molecules and dissolved ions; sand and salt retain their own particles.
- An empty vessel is unclassified, not a pure substance.

The 18 displayed markers illustrate particle identity and composition. Oxygen atoms are red in O₂, H₂O and CO₂; hydrogen is white, carbon is dark, and Na⁺/Cl⁻ ions have separate charge-ring markers and legend symbols. Pure water stays H₂O: a bent molecule with two O–H bonds. O₂ and N₂ show two bonded same-element atoms. Solid sodium chloride is shown as an alternating Na⁺/Cl⁻ lattice; dissolved ions remain individually dispersed in the water sample. Physically combining samples changes which identities appear together; it does not silently form new chemical bonds. The 2D fallback uses the same engine positions and constituent colours.

## Atoms · molecules · ions comparison (4.4.1)

Five quick-switch cards compare argon (single atoms), oxygen O₂ and water H₂O (molecules), sodium chloride (ions in a lattice) and salt water (a mixture). Each shows a one-paragraph particle-theory explanation of a property: gas particles far apart so the gas fills its container; water molecules close but able to slide so water flows; the ionic lattice rigid with a high melting point (about 800 °C); mixture components keeping their own properties. An optional classification check remains below.

## Sorting task (4.4.2)

All eight classify samples are listed with Element / Compound / Mixture buttons. Feedback is immediate, a wrong guess gets a hint that does not reveal the answer, and the tally counts samples sorted, right first time, and attempts. The answer comes from the same `classifyComposition` rule as the classifier.

## Physical separation

The separation engine records each represented material mass in the remaining feed or a named output. Every selected technique moves only eligible materials; serial steps preserve the total represented mass.

| Technique | Modelled property | Model result |
| --- | --- | --- |
| Sieving | Grain size relative to mesh | Coarse particles pass to the sieve catch; smaller particles remain. |
| Magnetic separation | Magnetic response | Iron filings move to a magnetic catch; sand remains. |
| Settling and decanting | Density and insolubility | Dense insoluble solids settle; the clear liquid is gently poured from above the sediment. Dissolved substances travel with that liquid. For immiscible oil and water, the model transfers the separate oil layer. |
| Filtration | Suspended particle size and insolubility | Suspended sand is retained; dissolved salt passes through with the water. |
| Evaporation | Volatility | Water is accounted as vapour; nonvolatile salt remains as residue (shown as dry crystals once no water is left). |
| Add water & stir (guided challenge only) | Solubility in water | Salt crystals become dissolved ions in 100 g of added water; sand and iron stay solid. The added water is counted in the conserved total. |
| Distillation | Different boiling/condensation behaviour | Water is accounted as condensate; nonvolatile solute remains in the residue. |

Filtration and decanting need a liquid: filtering a dry mixture moves nothing. Every output records the technique that produced it, and each action may carry a short explanatory note (for example 'sand is still mixed in with the salt. Filter before evaporating').

### Guided investigation (4.4.4)

The feed is 15 g iron filings, 40 g sand and 20 g salt crystals. Students order the steps magnet, add water, filter and evaporate; each run is recorded automatically in the trial table with the recovered masses. `investigationReport` judges the three products: iron in the magnetic catch, sand in the filter residue, and dry salt left in the basin once the water has gone. Only two of the 24 orderings give three pure products (magnet then dissolve, or dissolve then magnet, always before filter then evaporate). Evaporating before filtering leaves sand in the salt; skipping the magnet puts iron in the sand residue. A wrong order can be rescued by dissolving the dried salt again (more water is added and counted). Mass is conserved: `separationMassG(state) === separationExpectedMassG(state)` (feed plus added water) at every step.

### Apparatus

Each technique shows seated apparatus at one consistent bench scale: retort stand and ring clamp holding a funnel with a folded filter-paper cone over a receiving beaker (residue on the paper, filtrate below with dissolved ions in the particle view); a mesh sieve resting on a glass bowl; a bar magnet with attracted filings; a beaker tilted on a wedge pouring clear liquid into a second beaker, sediment left behind; an evaporating basin on gauze and tripod over a Bunsen burner; and a flask, clamped Liebig condenser and receiver. Sand settles on the bottom of vessels and dissolved salt is shown as dispersed Na⁺ and Cl⁻ ions among water molecules. Recovered products stand in dishes at the front of the bench.

The represented mixtures and amounts are chosen teaching samples, not calibrated laboratory yields. Repeated methods act on the remaining feed. A result of zero indicates that the selected technique did not separate any material in that sample. The oil/water evaporation and distillation comparison treats oil as a heavy, nonvolatile model component so water is the component that evaporates or condenses; real oils vary in composition and volatility.

## Yandying investigation

The dish is a muted, unpatterned brown bowl (no invented designs); seeds are dark brown and chaff is straw-coloured so they stay distinguishable. This generic unadorned shallow bowl makes tilt and shaking control a schematic size/density separation. Seed-like particles have a tapered oval shape; light chaff uses broad thin markers. With more repeated motion and a steeper tilt, the model sorts a seed-like fraction from lighter chaff-like markers. Four adjustable properties (seed/chaff size and density) feed the sorting calculation, so changing their contrast changes the recovered fractions; the represented total mass remains fixed. Default seed/chaff values are small, dense seed markers versus larger, lighter chaff markers. All displayed sizes and densities are illustrative values, not sourced botanical measurements. The display does not reproduce a specific community process or claim cultural endorsement. A comparison prompt asks how the combined size/density/tilt process differs from a sieve’s size cutoff.

ACARA's public Year 7 Science teacher background discusses yandying, identifies the word as Yindjibarni from the Pilbara, and gives a specific double-yandying mulga-seed example associated with Yankunytjatjara people in north-western South Australia. The context card is always visible beside the controls (not hidden in a collapsed section). It uses ACARA's spelling, 'Yindjibarni people of the Pilbara region in Western Australia (also spelled Yindjibarndi)', lists the five-step double-yandying sequence (threshing and rubbing seeds from pods; yandy to remove pod fragments; bake in hot sand and ashes; yandy again to remove sand and ashes; grind and moisten into a paste) and states that this is living knowledge belonging to the communities, that the dish is a generic model, and that teachers are encouraged to consult local Aboriginal community members or education officers. No facts beyond the ACARA source are added. The on-screen context identifies both the word-origin context and that particular example without treating the term as exclusive ownership of the general separation principle. [ACARA teacher background, section E6](https://www.australiancurriculum.edu.au/support-resources/background-information/science_teacher_background_information_AC9S7U06_E6)

## Industrial water filtration

The Sydney Water example represents a teaching feed of water, large debris, suspended sediment and dissolved salt. The scene is a connected treatment train on stepped plinths so water falls downhill: an inflow channel with an inclined bar screen (debris collects on the bars), a chute into a flocculation tank with a coagulant dosing drip and a paddle mixer (fine dust becomes floc clumps after flocculation), an overflow weir into a launder trough, and a filter bed with an underdrain, gravel, sand and anthracite layers feeding a clear-water outlet tank. Flow arrows mark the path. Screening removes most represented large debris. Coagulant addition is labelled as a chemical treatment aid that helps fine suspended particles form flocs; the model's relative dose changes later filter capture but dose chemistry/mass is not in the pollutant ledger. Flocculation alone changes grouping but does not remove pollutant mass. Screen and filter media physically separate particles, with captured matter transferred to tracked waste (`stageLog` records what each stage removed so the scene can show where it was caught). Dissolved salt remains in the treated-water fraction; a physical filter does not remove it in this model.

The readout for suspended material is a model clarity measure only. It does not assess pathogens, dissolved chemicals or drinking-water safety. Water that looks clear is not evidence of safety. Detailed coagulant chemistry, disinfection, operational monitoring and the full treatment plant are outside the simulation. The screen/floc/filter sequence is an instructional simplification of the public [Sydney Water filtration resource](https://www.sydneywater.com.au/education/drinking-water/water-quality-filtration.html).

## Accessibility and framing

The scene region's accessible name is rebuilt from state: the sample, the selected apparatus, what remains and the recovered outputs (or the stages run, for the treatment train). Space and R keyboard shortcuts and all button/slider names are unchanged; new controls (cards, sort buttons, step buttons) have explicit names. The camera is fitted from each apparatus's frame and the canvas aspect ratio, so the model fills the stage at 1440×900 and 390×844 without clipping.
