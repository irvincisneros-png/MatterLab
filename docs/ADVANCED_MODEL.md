# Beyond Three model notes

Beyond Three contains two optional atomic-gas examples. They use models separate from the water molecule simulator. They are two examples, not a claim that matter has only five possible states.

## Hydrogen plasma

The plasma example represents a fixed sample of 24 hydrogen nuclei, each paired with one electron in its initial neutral-atom population. The 24 count is the full model ledger, not a literal claim about how many atoms are in a real gas or how many are visibly drawn.

The relative energy control selects a deliberately simple ionised fraction. Above its display threshold, each represented ionisation converts one neutral hydrogen atom into one positive ion and one free electron. Lowering the energy recombines those same model constituents: a free electron becomes bound to a positive ion. The engine therefore preserves all 24 nuclei, all 24 electrons, and zero net charge at every slider value. The response curve is a teaching control, not a calibrated hydrogen ionisation curve, rate equation, or temperature scale.

The signed electric-field control is dimensionless and illustrative. It reports the direction of the electric force, using the sign of `qE`: positive ions respond along the field, electrons in the opposite direction, and neutral atoms have zero charged force. The live 3D arrows update when the field changes. They are force-direction cues, not particle paths, velocities, or a prediction that charges instantly reverse their motion. Playback moves schematic markers independently of the field; it does not model collision rates, self-consistent fields, plasma waves, or charge separation. Particle types are stated in text and counts as well as distinguished by colour.

The model's neutral hydrogen atoms are drawn with a nucleus, a bound-electron cue, and a schematic orbit. Positive ions and free electrons are drawn separately. Markers are visual representatives, not a literal 24-atom gas. The DOE overview describes plasma as an ionised gas containing positive ions and negative electrons and notes the complexity of their interactions; this small model covers the charge bookkeeping and elementary force direction only: [DOE Explains…Plasma](https://www.energy.gov/science/doe-explainsplasma).

## Trapped rubidium-87 gas

The condensate example uses a positive temperature control from 10 to 360 nanokelvins. A nanokelvin (nK) is one billionth of a kelvin. The control cannot reach absolute zero. The historical reference preset is a model critical temperature, `Tc = 180 nK`, inspired by the NIST observation in which the condensate fraction first appeared near 180 nK at a reported density of `2.5 × 10¹² cm⁻³` in that experiment's magnetic trap. This is not a universal BEC threshold, and the interface does not claim that its fixed 48 markers reproduce that trap or density. [NIST, Anderson et al.](https://www.nist.gov/publications/observation-bose-einstein-condensation-dilute-atomic-vapor-below-200-nanokelvins-0)

For an ideal Bose gas in a three-dimensional harmonic trap, the model uses

```text
condensate fraction = 1 − (T / Tc)³    when 0 < T < Tc
condensate fraction = 0                when T ≥ Tc
thermal fraction   = 1 − condensate fraction
```

This is the ideal, non-interacting, fixed-harmonic-trap relation. The representation omits finite-size corrections, interatomic interactions, trap changes, losses, and a full quantum or thermodynamic solution. Its assumptions are important because real trapped-gas behavior can differ. The relation follows the ideal harmonic-trap treatment discussed in Dalfovo et al., *Theory of Bose-Einstein condensation in trapped gases*, *Reviews of Modern Physics* 71, 463 (1999), [doi:10.1103/RevModPhys.71.463](https://doi.org/10.1103/RevModPhys.71.463).

The ledger always conserves the 48 schematic markers. The condensed and thermal counts are rounded visual representatives of the computed fractions; they do not identify a real 48-atom experiment. Cooling changes which component those same atoms represent. Atoms remain rubidium atoms, keep moving in playback, and do not merge chemically into one atom or become a motionless ordinary solid. The central wave and density cues are schematic representations of a shared quantum-state component, not a resolved wavefunction or calibrated density profile.

## Shared interaction and accessibility behavior

Each experiment has its own controls, playback, single-step action, reset, camera orbit and camera reset. Playback advances illustrative marker motion only; it does not change plasma composition, electric field, BEC temperature, or condensate fraction. The keyboard shortcut Space toggles playback unless focus is in a native control; `R` resets the experiments. Reduced-motion preference starts playback paused; choosing Play explicitly opts into animation, while manual stepping remains available. Native controls, live count text, a labelled 2D science view, and a retry control remain available if WebGL is missing or fails. DOM labels sit outside the Three.js canvas so screen readers and keyboard users have equivalent state information.

The examples are inspired by introductory plasma charge separation and trapped-gas condensation. They do not model an exhaustive catalogue of matter states or imply that plasma and a condensate are produced by rearranging water molecules.
