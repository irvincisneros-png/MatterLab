# Science model and limits

## What the samples represent

Each chamber contains the same 0.20 kg model sample and 18 persistent, illustrative H₂O molecules. The samples start at different thermal conditions: −20 °C ice, 22 °C liquid water, and 118 °C water vapour. This is a comparison preset, not a claim that the three samples are in equilibrium together.

Vessel dimensions and particle spacing are schematic. The gas chamber is scaled 1.18× in each visible dimension to suggest its much larger representative volume. Gas is invisible in everyday view. The particle representation shows molecules; it is not a picture of steam or a measured molecular scale.

At the melting point the ice lattice is modelled with about 1.09× the volume of the same mass of liquid water. The macro geometry uses the same chamber cross-section for the ice and liquid, with ice height scaled by 1.09. This represents ice's lower density near 0 °C. USGS background: [Water density](https://www.usgs.gov/water-science-school/science/water-density) and [Properties of water](https://www.usgs.gov/water-science-school/properties-water).

## Energy model

The independent engine stores energy relative to 0 °C ice, then derives temperature and phase fractions. For the 0.20 kg pure-water sample it uses these classroom values:

| Quantity | Model value | Result for 0.20 kg |
| --- | ---: | ---: |
| Ice specific heat capacity | 2.1 kJ kg⁻¹ °C⁻¹ | 0.42 kJ °C⁻¹ |
| Water specific heat capacity | 4.18 kJ kg⁻¹ °C⁻¹ | 0.836 kJ °C⁻¹ |
| Water-vapour specific heat capacity | 2.0 kJ kg⁻¹ °C⁻¹ | 0.40 kJ °C⁻¹ |
| Latent heat of fusion | 334 kJ kg⁻¹ | 66.8 kJ |
| Latent heat of vaporisation | 2256 kJ kg⁻¹ | 451.2 kJ |

Below 0 °C, energy changes the ice temperature. Between 0 and 66.8 kJ, temperature stays at 0 °C while ice/liquid fractions change. Liquid water then warms from 0 to 100 °C. Between 150.4 and 601.6 kJ, temperature stays at 100 °C while liquid/vapour fractions change. Vapour temperature rises above 100 °C after that plateau.

These are idealised plateaux at fixed pressure near 1 atm. The model limits temperature to −273.15 °C through 250 °C. It does not model pressure changes, evaporation below boiling, weather, heat loss, apparatus uncertainty, or measured experimental data. ACS background: [Changing state teacher background](https://www.acs.org/content/dam/acsorg/msc/downloads/chapter-2/lesson-5/ch2-l5-teacher-background.pdf).

Changing playback speed changes how quickly fixed 1/60-second model-time steps are played. It does not change sample energy, temperature, or phase fractions. A manual Step advances 0.08 model seconds and pauses playback. Energy input is a separate control.

The Change Station uses a second, explicit model for surface-driven evaporation, sublimation and deposition; environmental flux is qualitative and accelerated, not a calibrated rate. The six transition descriptions, humidity/temperature effects, challenge rules and conserved water ledger are documented in [Transition model and limits](TRANSITIONS_MODEL.md). Beyond Three uses separate illustrative hydrogen-plasma and rubidium-87 trapped-gas models. Their assumptions, conserved particle/charge counts and limits are in [Advanced model and limits](ADVANCED_MODEL.md); these are not additional stages in the water energy model above.

## Particle arrangement and forces

Solid molecules vibrate around an ordered arrangement. Liquid molecules remain close while rearranging and exchanging neighbours. Gas molecules travel through the available chamber. The motion is deterministic and schematic rather than molecular dynamics. Heating does not enlarge molecule meshes. The same 18 molecule identities remain present when the derived phase changes.

Attraction cues are qualitative comparisons only. They are not calibrated force values and do not draw attractions as bonds between separate H₂O molecules. The O–H bonds inside each H₂O model remain intact during phase changes. ACS background: [Properties of matter](https://www.acs.org/middleschoolchemistry/lessonplans/chapter1.html).

## Tilt and graphics

Chambers rotate no further than ±35°. The liquid free surface is solved from a fixed represented fill volume, clipped at the chamber floor, and drawn so the surface remains horizontal relative to gravity. The 2D alternative rotates the chamber frame and counter-rotates the liquid surface; its particle layout uses the same engine positions.

The scene is not computational fluid dynamics. Mixed-phase macro shapes and molecular placement are simplified for readability. Ice particles during melting follow the floating ice mesh. Gas remains spread through its larger chamber without a visible fog or white steam cloud.

## States view: equal chambers and particle arrangement

- The three chambers are identical in size (the gas chamber is no longer scaled up). The camera uses a 14 degree field of view from a far distance, fitted to the canvas aspect ratio, so perspective does not make the nearer chamber look larger.
- Particle arrangements follow `deriveMoleculePositions`: hexagonal ice lattice (vibration only), close-packed disordered moving liquid, far-apart fast gas. The 18 molecule identities and counts are unchanged across phases.
