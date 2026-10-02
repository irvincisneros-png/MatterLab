# Water pollution model and limits

The Pollution laboratory begins with a 1,000 mL clean model water body. Students can add a floating oil film, floating litter, suspended sediment and dissolved salt. Each pollutant has its own input, current location, recovered amount and waste amount. For each material the engine checks

```text
input = surface + suspended + dissolved + settled + recovered + waste
```

Here, `recovered` is shown explicitly in the interface as pollutant recovered as material and pollutant carried into recovered water. Decanting does not turn a salty water stream into a clean one: salt and remaining suspended particles are transferred to the recovered-water compartment and remain in the pollutant ledger until a later treatment such as distillation handles that stream.

Water has a separate volume ledger:

```text
1,000 mL input = water body + recovered water + waste water
```

EPA identifies oil and grease, sediment, salts and other runoff material as water pollutants; NOAA describes trash and marine debris entering oceans and waterways from storm drains, sewers, shorelines and recreation. These are the grounded input categories for the model. [US EPA, Nonpoint Source Pollution](https://www.epa.gov/nps/basic-information-about-nonpoint-source-nps-pollution), [NOAA, Marine Debris](https://oceanservice.noaa.gov/facts/marinedebris.html)

## Pollutant behaviour

- **Heavy oil** stays as a floating surface film in this small calm sample. It is explicitly treated as a heavy, nonvolatile oil fraction for the distillation demonstration; real petroleum mixtures can contain volatile components. A skimmer transfers 78% of the accessible film to a recovered-oil store and carries 4 mL water into waste. These percentages are illustrative, not a real skimmer efficiency.
- **Litter** remains as floating solid pieces until a coarse screen captures 96% of the accessible debris. The model records 3 mL of trapped water as waste water.
- **Sediment** begins suspended and settles into a bed at an accelerated illustrative rate of 2.4 g per model second. Decanting recovers 72% of the upper water layer after some sediment has settled; bed sludge stays in the source vessel. Dissolved salt and any remaining uniformly suspended fine sediment travel proportionally with the decanted water and are recorded in the recovered-pollutant column. Filtration removes 94% of suspended sediment and carries 8 mL water into waste; settled sediment remains on the bed.
- **Salt** dissolves into a visible ledger quantity but remains invisible in macro water view. It does not settle, float or disappear during simple screening and filtering. Only the separate distillation action moves it to waste.

The qualitative clarity index is `round(clamp(100 − 2.8 × suspended sediment in grams, 0, 100))`. It is driven only by suspended sediment; dissolved salt, microbial hazards, dissolved chemicals and the full range of water-quality indicators are not represented. Oil films and litter remain independently visible. Clear appearance is never presented as evidence that water is safe to drink.

NOAA describes skimming as recovering floating oil from the surface, often with a boom, and notes that skimmers can collect some water along with the oil. The simulation represents this surface targeting and explicit captured-oil/water outputs but does not model spill size, weather, currents, oil type or field performance. [NOAA, Oil Spill Response](https://oceanservice.noaa.gov/education/tutorial-coastal/oil-spills/os06-sub-01.html), [NOAA, How oil spills at sea are cleaned up](https://response.restoration.noaa.gov/node/1489)

EPA's educational filtration activity describes settling and filtration as methods for removing suspended particles. The simulation keeps that physical distinction: decanting can remove material already settled on the bed, while a filter captures suspended solids. [US EPA, Water Filtration for Students](https://www3.epa.gov/safewater/kids/grades_4-8_water_filtration.html)

## Distillation and outputs

The simplified still transfers all currently remaining modeled pollutants, including salt, heavy oil, litter and sediment, into a waste-residue ledger. It processes both water still in the body and any previously decanted water, returns 90% of that combined stream as recovered water and sends the other 10% to waste water. This also ensures dissolved salt carried into a decanted output is not silently treated as clean. It illustrates separating water from nonvolatile pollutants. It assumes the oil is a heavy, nonvolatile fraction and that none of the modeled pollutants evaporates or contaminates the condensed water; real petroleum mixtures and waters can contain volatile compounds and many unmodeled hazards, so this is not a drinking-water treatment design or safety certificate.

Skimming, screening, decanting, filtering and distillation move pollutant mass between explicit compartments. Applying an empty treatment can still appear in the planned treatment sequence, but it cannot make mass vanish. Every per-pollutant ledger and the water-volume ledger remain inspectable. Reset starts a new model body while retaining the student's recorded trials; loading a matched sample begins a new 1,000 mL feed with the same 6 g oil, 8 g litter, 32 g sediment and 12 g salt for comparable tests.

## Planning and challenge

The controlled investigation varies the selected treatment, while keeping the matched starting volume and pollutant recipe fixed. Students can apply several treatments, record the sequence, and compare remaining pollutant mass, visual clarity, recovered water and waste in a table and graph. The recorded clarity value is a qualitative model index, not a measured turbidity unit.

The challenge asks students to filter the matched mixture and observe that 12 g dissolved salt remains, then distil to transfer salt to waste and recover water. The challenge passes only after the filter action leaves salt in the body and a later distillation removes modeled salt and records recovered water.

The tank, shoreline, inlet and treatment-station props, pollutant-marker sizes and counts are schematic, not a literal ecosystem, spill response forecast, treatment-plant design or drinking-water assessment. The selected apparatus shows the planned method; pollutant mass moves only after the student applies that treatment, and only the engine ledger defines its output. Playback advances settling and marker time at a bounded fixed step; manual Step advances one model second. The 2D labelled body and controls remain usable if WebGL is unavailable. Reduced-motion preference slows playback, the lab starts paused, and Space / R provide play/pause and reset keyboard access.

## Scene and outputs (water-body rebuild)

- The 3D scene is a pond/creek diorama (`src/components/scene/PollutionScene.tsx`): sculpted banks and a sloped bed, a stormwater culvert feeding a creek, reeds, rocks and a tree. The water level follows the conserved water volume (`waterBodyMl`).
- Each pollutant sits in its own place: oil is a film on the surface, litter floats, suspended sediment hangs in the water (turbidity) and settles into a deposit on the bed, dissolved salt is not drawn at all. Particle view adds Na+ (purple) and Cl- (green) ions only.
- Treatment apparatus (`PollutionApparatus.tsx`) is drawn as real equipment: drum skimmer with boom, bar screen, settling jar with siphon, filter funnel on a retort stand, still with Liebig condenser.
- Four outputs are kept apart and labelled: 1 water body (pollutant left), 2 recovered water (mL, with a "still holds dissolved salt / untested" note), 3 recovered material, 4 waste. `pollutionOutputs()` returns all four from the ledger; the sum of pollutant mass across them equals the input.
- `describePollutionScene()` builds the state-aware accessible name of the canvas and the 2D fallback (mass by location, clarity, last treatment, outputs, and "looking clear is not a safety test").
- Model limit: recovered water is never presented as safe; clarity reflects suspended sediment only.
