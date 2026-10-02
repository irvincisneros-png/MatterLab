# Water Topic model and limits

This module provides five directly usable investigations: Earth water cycle, heating water, water properties, liquid density, and solid-object density. Each activity labels which values come from its live teaching model, student equipment actions, or published reference data.

## 4.1.1 · Earth water cycle

The landscape follows one tracked 1.00 kg sample through separate pools: ocean liquid, land-surface liquid, groundwater, cloud droplets, cloud ice crystals, atmospheric water vapour, and snow/glacier ice. Their masses sum to 1.00 kg. Atmospheric water vapour is a gas and is invisible in everyday view; the visible clouds are made of liquid droplets or ice crystals, which are not vapour. A legend in the stage states this distinction. The particle toggle turns the cloud translucent and shows droplets as small clusters of H₂O molecules, ice crystals as ordered hexagonal clusters, and vapour as a sparse, faint, labelled scatter of single molecules spread far apart through the air. Counts are schematic and scale only loosely with the pools; molecule size is not to scale.

Sun heating affects ocean evaporation and snow/glacier melting. Nearby air temperature and humidity affect vapour condensation into liquid cloud droplets. In cold air those droplets can freeze into cloud ice; warming can melt cloud ice back into droplets. The precipitation control returns the tracked cloud liquid to land as rain, or cloud ice to snow/glacier storage when the model air is at or below 0 °C. Surface water can infiltrate, run off to the ocean, and groundwater can flow toward the ocean. These are qualitative instructional rates, accelerated for use during a lesson. The model does not simulate atmospheric circulation, condensation nuclei, cloud microphysics, real catchments, time-varying forecasts, or global water budgets. Changing conditions are not claims about current local weather. The pool total remains fixed during every modeled transfer.

The source-grounded cycle sequence follows USGS descriptions of sun-driven ocean evaporation, cooling/condensation into clouds, rain and snow returning water, and snow/glacier storage ([USGS Hydrologic Cycle](https://www.usgs.gov/centers/new-york-water-science-center/science/hydrologic-cycle?qt-science_center_objects=0), [USGS Condensation](https://www.usgs.gov/water-science-school/science/condensation-and-water-cycle), [USGS Precipitation](https://www.usgs.gov/water-science-school/science/precipitation-and-water-cycle)).

## 4.1.2 · Heating-water investigation

The heating trial uses the existing verified pure-water thermal engine in `matterEngine.ts`. Students can begin with −20 °C ice or 22 °C liquid water, select a hot plate or immersion heater, set the model power, select a thermometer display scale, play/pause, take exact one-second manual steps, and record readings. The existing ideal latent-heat plateaux remain at 0 °C and 100 °C near 1 atm. Heater power ranges are 0.1–2.0 kW for the hot plate and 0.1–1.5 kW for the immersion heater. These are declared lesson-model settings; the scene is not a calibrated representation of a specific school appliance.

Physical model time advances in fixed 1/60-second steps. Playback factors of 1×, 4×, 10× and 20× change how quickly those steps are displayed. They do not alter heater power, sample energy per model second, model-time labels, or recorded readings. The selected digital-probe display rounds readings to 0.1 °C; the simulated glass thermometer reads to 1 °C. This is a declared classroom instrument resolution, not an accuracy claim. Readings are collected only when students press **Record thermometer reading**. The graph connects those measurements and shows a separate live point; optional CSV export contains only the recorded trial table.

The plateaux and heating values are documented in [SCIENCE_MODEL.md](./SCIENCE_MODEL.md) and are based on the supplied ACS changing-state teacher background. The hot-plate setting ranges from 0.1–2.0 kW and the immersion-heater setting from 0.1–1.5 kW; an immersion heater cannot be selected for the ice-start trial. Those controls represent choices in this lesson model and do not assert specifications for a named real appliance.

## 4.2.1 · Water properties

### Density

Pure-water reference density is taken from the rounded temperature table in the [USGS Water Density page](https://www.usgs.gov/water-science-school/science/water-density). The displayed function linearly interpolates between those rounded values from 0 to 60 °C. That interpolation is an instructional approximation, not a complete equation of state. The reference table has its maximum at 4 °C; density falls on either side. Density is shown in both g/mL and kg/m³ using the exact unit relation `1 g/mL = 1000 kg/m³`.

The USGS page gives rounded values such as 0 °C: 0.99987 g/cm³, 4 °C: 1.00000 g/cm³, 10 °C: 0.99975 g/cm³, and 21 °C: 0.99802 g/cm³. The live 20 °C reference used in the liquid-density table is 0.9982336 g/mL at 1 atm (shown rounded as 998.234 kg/m³), from [NIST Journal of Research, “Absolute Viscosity of Water at 20 °C”](https://nvlpubs.nist.gov/nistpubs/jres/048/1/V48.N01.A01.pdf). The table curve and this higher-precision comparison point have different rounding and sources; both are shown with their named conditions rather than presented as interchangeable measurements.

### Buoyancy

The watertight object model uses Archimedes’ relationship: buoyant force equals the weight of displaced liquid, `Fᵦ = ρ_liquid × g × V_displaced`; object weight is `m × g`. For a floating object, displaced volume adjusts until buoyant force balances weight. An object with average density below the liquid floats, one with greater average density sinks, and one at equal density is neutrally buoyant and remains fully submerged. A hollow boat uses its outside volume, which includes trapped air, and the mass slider is its total mass including cargo. The scene does not simulate water flow, flexible hulls, leaks, or a force sensor.

### Surface tension

The paperclip experiment is categorical and separate from the Archimedes calculation. Gentle placement may leave a dense clip supported by the water surface; pushing it through or adding the modeled detergent drop removes that support. It reports no numerical surface force and is not calibrated to a detergent concentration. The distinction follows [USGS Surface Tension and Water](https://www.usgs.gov/water-science-school/science/surface-tension-and-water) and the [ACS paperclip and water-strider demonstration](https://www.acs.org/middleschoolchemistry/simulations/chapter5/lesson2.html).

## 4.2.2 · Liquid-density equipment investigation

Students select pure water at 20 °C or pure ethanol at 20 °C, choose mass and volume equipment, tare the empty 34.2 g sample cup, record the meniscus, read the balance, and then save a row to the comparison table. The appropriate mass tool is a balance; a ruler measures length and a thermometer measures temperature, so selecting those tools disables mass recording and gives a reason. The graduated cylinder has 1 mL divisions. A 100 mL beaker remains usable but has coarse 10 mL divisions, so the recorded meniscus rounds to that resolution; each result row records the equipment and division. The balance mass is generated from the actual selected fill volume, independently of which volume tool is used. Therefore the same 47 mL fill gives the same rounded 46.9 g net balance reading with either tool, while a coarse 50 mL beaker reading yields a different calculated density from a 47 mL cylinder reading. An empty or zero-volume cylinder cannot be recorded as a valid density. The simulation rounds balance readings to 0.1 g; readings are compared with the reference rather than substituted by a hidden answer.

Reference values shown in the table are:

- Pure water: 998.234 kg/m³ at 20 °C and 1 atm, rounded from NIST's 0.9982336 g/mL reference.
- Pure ethanol: 789.37 kg/m³ at 20 °C, from the [NIST selected ethanol values](https://srd.nist.gov/JPCRD/jpcrdS1Vol2.pdf).

The ethanol record represents pure reference ethanol, not retail 70% or 91% rubbing alcohol. The virtual sample mass is generated from its named reference density so students can examine resolution and rounding; it is not a physical measurement. A real laboratory should use appropriate safety controls for alcohols.

## 4.2.3 · Regular and irregular object density

The regular block uses three ruler readings and `V = length × width × height`. The irregular specimen uses initial and final graduated-cylinder menisci; its measured volume is `final level − initial level`, with `1 mL = 1 cm³`. The student independently tares and reads the scale, calculates density as `ρ = mass / volume`, and records the result in both g/cm³ and kg/m³. The calculation rejects zero or invalid volume. The reference comparison is not revealed as the measurement: the mass and volume are collected by equipment actions first.

Reference values use typical aluminium at 2.7 g/cm³, with the NIST reference table’s temperature unspecified, and brass at 8.3909 g/cm³ at 20 °C ([NIST Table 9.10](https://www.nist.gov/system/files/documents/2017/05/09/reference-tables-dec-2003.pdf)). Aluminium alloys vary, so 2.7 g/cm³ is a broad classroom reference only. The brass object is a nominal modeled sample; real composition can vary.

## Runtime assets and sources

The scene uses procedural local Three.js geometry. The water cycle is a smoothly displaced terrain mesh (a PlaneGeometry driven by one height function) with vertex colours for sea-bed, beach, grass, rock and snow; a snow line that drops as more water is stored as snow and glacier ice; a glacier tongue; a river ribbon that follows the terrain down to the ocean; a cutaway wall showing soil, a groundwater-saturated layer whose thickness follows the groundwater pool, and bedrock; an ocean surface with gentle animated waves (frozen when the user prefers reduced motion); instanced trees; merged-sphere clouds; an emissive sun with a soft glow; and rain (cold air above 0 °C) or snow (air at or below 0 °C) drawn from the cloud pool. Apparatus for 4.2.3 is built at one consistent scale (1 cm of object = 0.17 scene units, so an object's displaced volume matches the rise in the 100 mL cylinder): the specimen rests on the balance pan when weighed and on the bench otherwise, a 10 cm ruler lies along the object's edge while measuring with an attached readout, and an irregular specimen lies on the cylinder floor with the raised meniscus and the initial-level mark visible. The balance shows 0.0 g when nothing is on the pan, so the weighed value is kept in the readings panel. The hollow boat is an open hull and the surface-tension setup uses a flat wire paperclip and a dropper. These are explanatory illustrations: only values in the student controls, instrument readouts and recorded tables are model measurements; the 3D scale marks and equipment shape are schematic.

### Particle views

Water molecules are never scattered decoratively. In 4.2.1, 4.2.2 and 4.2.3 a framed circular "zoom lens" is joined to the liquid by a leader line and is labelled "not to scale". It shows a fixed lens volume of close-packed, jostling molecules. The molecule count follows real number density, ρ/M: water 998.2 kg/m³ ÷ 18.015 g/mol and ethanol 789.4 kg/m³ ÷ 46.07 g/mol give ethanol about 0.31 times as many molecules per millilitre, so the ethanol lens shows fewer, larger (C₂H₅OH, drawn with dark carbon) molecules. Solid objects and the air never contain molecules. In 4.1.2 (27 molecule identities) ice is a solid block with an ordered 3 × 3 lattice, floating with 91.7 % submerged once liquid exists; liquid molecules are evenly spread through the whole water volume at touching spacing; vapour is shown only in particle view as faint, sparse, fast-moving molecules in the air above the liquid (the vessel is open). Boiling shows vapour bubbles in the liquid, not steam. Oxygen is red and hydrogen white throughout.

All apparatus, reservoirs, landscape, particles and graphs are generated from local Three.js, SVG, canvas textures and DOM code. No runtime network assets are used. The module inherits the locally bundled Lexend font and shared cool-water palette.

- [USGS Water Density](https://www.usgs.gov/water-science-school/science/water-density) — water density and its temperature trend.
- [USGS water-cycle sources](https://www.usgs.gov/centers/new-york-water-science-center/science/hydrologic-cycle?qt-science_center_objects=0) — water pools, sunlight, clouds, runoff and ice storage.
- [USGS Surface Tension and Water](https://www.usgs.gov/water-science-school/science/surface-tension-and-water) — cohesive surface support.
- [ACS Chapter 3: Density](https://www.acs.org/middleschoolchemistry/lessonplans/chapter3.html) — mass/volume, displacement, sinking, floating and temperature effects.
- [ACS Lesson 3.2: Water Displacement](https://www.acs.org/middleschoolchemistry/lessonplans/chapter3/lesson2.html) — graduated cylinder, meniscus and displacement calculation.
- [ACS Lesson 5.2: Surface Tension](https://www.acs.org/middleschoolchemistry/simulations/chapter5/lesson2.html) — dense paperclip and water-strider observations.
- [NIST Journal of Research: Absolute Viscosity of Water at 20 °C](https://nvlpubs.nist.gov/nistpubs/jres/048/1/V48.N01.A01.pdf) — pure-water reference density at 20 °C and 1 atm.
- [NIST ethanol reference data](https://srd.nist.gov/JPCRD/jpcrdS1Vol2.pdf) — pure ethanol density at 20 °C.
- [NIST Table 9.10](https://www.nist.gov/system/files/documents/2017/05/09/reference-tables-dec-2003.pdf) — typical aluminium and brass densities and the stated brass temperature.
