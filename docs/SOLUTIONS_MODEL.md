# Solutions model and limits

The Solutions laboratory contains five directly selectable experiences: dissolving, investigation, temperature, particles and comparison. It represents a fixed sample of **100 g water**. Solute is weighed in grams; at every point the engine conserves `solute added = dissolved solute + undissolved/crystallised solute`. Solvent mass stays fixed. Stirring and coarse/fine crystal controls affect an accelerated teaching rate; they never change the equilibrium capacity.

## Reference curves and units

The capacity curves are based on the American Chemical Society's rounded classroom table in Lesson 5.6, which gives sodium chloride, sucrose and potassium chloride at 0, 20, 40, 60, 80 and 100 °C. ACS publishes that table in grams per 100 mL water. The simulator fixes 100 g water, so it uses those rounded teaching points as an **approximate classroom curve per 100 g water**, rather than claiming a precision conversion or a new reference measurement. The nearest-gram values are suitable for comparing the steep sucrose curve with the much flatter salt curves; they are not a calibration standard. [ACS, Lesson 5.6](https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson6.html)

The sucrose values at 20 and 100 °C also match a published engineering course reference of 204 and 487 g per 100 g water respectively. [University of Georgia, sucrose solubility exercise](https://cmbe.engr.uga.edu/bche4520/Other/Homework/problem%20H.pdf) A laboratory exercise using potassium nitrate illustrates the same reporting convention of grams solute per 100 g solvent and determining equilibrium solubility by weighing. [Anoka-Ramsey Community College, Solubility Lab](https://webs.anokaramsey.edu/chemistry/Chem1062/Labs/Solubility/SolubilityLab-vm.htm)

| Solute | Kind | 0 °C | 20 °C | 40 °C | 60 °C | 80 °C | 100 °C |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Sodium chloride, NaCl | Ionic | 35.5 | 36 | 36.5 | 37.5 | 38 | 39 |
| Sucrose | Molecular | 179 | 204 | 241 | 288 | 363 | 487 |
| Potassium chloride, KCl | Ionic | 28 | 33 | 38 | 44 | 50 | 55 |
| Sand | Insoluble on model scale | 0 | 0 | 0 | 0 | 0 | 0 |

The engine linearly interpolates between these rounded anchor points. Sand's zero curve means no measurable dissolution in this model, not zero solubility under every condition. The slider cannot extrapolate outside 0–100 °C. Temperature responses differ by substance: sodium chloride and potassium chloride change modestly, while the sucrose curve rises steeply. A hotter solvent does not universally imply the same increase for every material.

## Rate, capacity and investigations

Dissolving proceeds toward `min(solute mass present, solubility capacity)` for the selected solute, solvent mass and temperature. A sample may still be dissolving below that limit; its dissolved mass is then only a lower bound for solubility. An unsaturated sample cannot establish the maximum amount that could dissolve.

An exact model investigation reading requires both equilibrium and a visible mass of excess solid. The table records the temperature, fixed water mass, material, added mass, dissolved mass, residue and whether the row is exact, a lower bound or still changing. The chart plots the published rounded curves and exact trial readings separately. Stirring and finer particles speed the model transfer without increasing the capacity. The animation is accelerated and does not predict a real dissolution time. As tuned, 10 g of NaCl with stirring and coarse crystals takes about 7 s of playback (about 3 s with fine crystals, about 23 s unstirred); the rate rises for larger gaps so that a 50 g addition still settles within roughly 20 s (stirred) to 60 s (unstirred). Sub-stepping makes one Step (1 model second) identical to sixty 1/60 s frames.

## Particle and constituent model

The common vocabulary is used in context: the **solute** is the material being dissolved; the **solvent** is water; a **solution** is the resulting uniform mixture; **soluble** means it can dissolve in the model at the selected conditions; and **solubility** is its equilibrium capacity under those conditions. The sand example is effectively insoluble at this scale.

For NaCl and KCl, every dissolved formula unit becomes one free positive ion and one free chloride ion. The engine keeps each constituent's mole and mass inventory consistent between dissolved ions and undissolved crystal. It never draws dissolved NaCl as intact NaCl molecules. Sucrose is covalent: entire sucrose molecules separate from the crystal and disperse; its internal atoms and covalent bonds stay together. Water remains H₂O. The rendered molecules, ions and crystal grains are schematic markers and are not a literal count of the sample.

### How the particle scene draws solids

- **Undissolved NaCl / KCl** are drawn as one to three cubic rock-salt lattices (alternating cation and anion sites with thin lattice bonds) resting on the beaker floor. Coarse crystals are a few larger blocks; fine crystals are many tiny 2 x 2 x 2 blocks. The number of lattice sites follows `ceil(8 x undissolved grams)` (capped), and the outer top corners are removed first as the undissolved mass falls.
- **While dissolving** (not at equilibrium, particles on), a few ions leave crystal corners. Each carries a short-lived hydration shell of three water molecules: the oxygen end faces a cation and the hydrogen end faces an anion, then the ion disperses into the liquid.
- **Undissolved sucrose** is a small crystal of packed whole molecules in random orientations; dissolved sucrose stays whole and bonded (it never splits into atoms or ions). **Sand** is a heap of grains that does not disperse.
- **Dissolved markers** are `min(24, ceil(dissolved g / 2.5))` per species. Bulk water markers (40) are spread through the whole liquid up to the meniscus and are placed outside the solid.
- **Weighing dish** shows a small heap of the same solid (mini lattices, a molecular cluster, or grains), never separated ions.
- Crystals are scaled for legibility, with schematic spacing; real NaCl crystals contain vastly more ions, and the hydration shell size (three waters) is illustrative (real shells hold about six). The illustrated 250 mL beaker graduations are orientation marks: the model fixes water mass at 100 g and omits volume change on dissolving. The small weighed crystal staging tray sits outside the vessel; it is not included in the conserved mass ledger until an Add control records an amount.

ACS describes the distinction directly: sodium and chloride ions separate and are surrounded by water, while intact sucrose molecules disperse without their covalent bonds coming apart. [ACS, Lesson 5.5](https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson5.html)

## Dilute, concentrated, saturated and supersaturated

Dilute and concentrated are **relative** concentration descriptions. The comparison view gives Sample A and Sample B the same solute, temperature and 100 g water mass, then compares the actual dissolved grams. It does not use an arbitrary fraction of capacity to define either word.

Saturated concerns capacity instead: at equilibrium, the solution has reached the selected solute's limit at that temperature. Excess undissolved crystals may be present; the solution portion remains at capacity. Concentrated does not imply saturated.

The supersaturation challenge starts from 250 g sucrose fully dissolved at 80 °C in 100 g water. This is below the approximate 80 °C capacity and begins without undissolved grains. When students cool the unseeded clear solution below the curve, it enters an intentionally metastable model state: the dissolved amount can exceed the new lower-temperature capacity while no crystals are shown. Adding a 0.2 g sucrose seed is an explicit new input. The model then returns the dissolved mass to the capacity and accounts for all remaining solute as crystals. No crystals appear in the metastable state before the seed action. This is a qualitative nucleation demonstration, not a prediction of crystallisation time, crystal size or crystal shape.

## Graphics, controls and limits

Playback advances the illustrative transfer and marker time in bounded fixed 1/60-second model steps; speed does not change the reference curve. Manual Step advances one model second. The stage can be orbited and reset. When WebGL fails, the DOM 2D beaker retains the controls, particle identity and mass ledger. Reduced-motion preference slows playback; it starts paused for everyone. The native range, select, table, graph, live ledger, Space play/pause and R reset all remain available.

The engine is an instructional equilibrium-capacity lookup with qualitative kinetic motion. It omits solution activity coefficients, pressure effects, pH, chemical reactions, evaporation, hydrate phases, density/volume changes on mixing and exact molecular dynamics. The temperature curve is approximate and must not be read more precisely than its published classroom data.
