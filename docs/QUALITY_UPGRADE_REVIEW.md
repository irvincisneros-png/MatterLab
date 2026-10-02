# Syllabus menu and 3D revision — 1 October 2026

The requested revision adds a main syllabus menu and improves the visibility, geometry and scientific identity of the existing lesson models. This is a revision of the complete nineteen-outcome site, with its original direct links retained.

## Classroom navigation

The no-hash entry and `#/` open the syllabus menu. Nineteen cards follow the supplied numerical order, grouped under 4.1–4.5, with activity titles, the exact outcome wording and direct launch links. Outcome 4.1.1 links to both the water cycle and three-state comparison. The missing formula image in 4.2.3 is clarified by the visible equation `ρ = mass ÷ volume`. Lessons have previous/next links and a menu return; plasma and BEC remain separate optional examples.

## Model changes and scientific review

- Shared procedural glassware now has a wall/base profile, spout, rim, graduation marks, meniscus and glass highlights. Studio lighting, laboratory benches and module-specific measuring/treatment apparatus give the models a clearer setting.
- Dissolving starts with visible water molecules and an explicitly separate weighed-solute tray. Added solid and dissolved particles follow the existing mass ledger. The former stirring control incorrectly negated the entire state object; it now toggles the stirring flag correctly, starts playback and shows an orbiting glass rod. Pausing freezes model time and rod motion; manual stepping advances both.
- Dissolved KCl is represented by potassium and chloride ions, rather than sodium. Dissolved cations and chloride follow separate schematic trajectories. Sucrose remains a whole bonded molecule.
- Oxygen is consistently red and hydrogen white in molecular models. Pure water classification, molecular element oxygen and the corresponding legends were checked visually.
- The sucrose asset uses the public [PubChem CID 5988 3D conformer](https://pubchem.ncbi.nlm.nih.gov/compound/5988), fetched from its [PUG REST JSON endpoint](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/5988/JSON?record_type=3d). Its locally bundled data contain twelve carbon, twenty-two hydrogen and eleven oxygen atoms with valid bonds. Geometry is merged by element and bond material to reduce draw calls. This single conformer is a teaching representation, not a prediction of the molecule's changing configuration in a liquid.
- Water models add terrain/coast/river/aquifer details, glassware, hotplate/probe, balance, ruler/displacement apparatus, boat hull, paperclip and dropper. Unrelated floating shapes were removed from the density view.
- Balance mass is generated from actual fill volume independently of volume-tool resolution. A 47 mL fill yields the same 46.9 g net mass for either tool; a coarse 50 mL volume observation changes calculated density. The tared balance display reads zero before weighing and net mass afterward.
- Mixture models add bonded particles, an ionic salt lattice, more recognisable separation tools and connected industrial treatment vessels. Yandying remains a generic unadorned mechanical model, with smaller denser markers sorting toward the lower side of the tilted dish.
- The pollution model adds a shoreline/inlet and treatment apparatus while preserving body, recovered-water, recovered-material and waste ledgers. Plasma electrodes and the BEC trap frame improve the optional apparatus without changing the charge or condensate models.

The physics engines, reference curve limitations and graphics fallback remain documented in the existing model files. Solution-vessel graduations are illustrative: solvent mass is fixed and volume change during mixing is omitted. Stirring-flow graphics are explanatory cues, not calibrated hydrodynamic predictions.

## Independent verification

The final parent production build and all 74 unit checks passed. The first complete browser run passed 48 of 56 checks; remaining failures concerned ambiguous new accessible labels, missing Canvas image attributes and overly long keyboard workflows. The stirring workflow was separated into its own regression test, bringing the catalogue to 57 browser cases. After repair, all 32 cases in the affected Solutions, syllabus-menu, Water and Transition files were verified: 31 passed together, and a graphics-capability-dependent context-loss case passed in a fresh single-worker run. The other 25 unchanged cases passed in the integrated run. Thus every current browser case has a passing result across the integrated and repair runs, without relaxing the physics assertions or increasing the global timeout.

The final Canvas descriptions are attached to the real rendering canvas and update with lesson mode. The visual-only removal of unrelated density props is in the final distribution. The parent confirmed the new production syllabus menu in Safari, including its nineteen entries, linked activities, density equation, optional atomic examples and section jumps. A separate new tab preserved the user's unrelated browsing page.

The parent inspected the running models privately: the syllabus cards and links, the default particle lens, added salt/stirring in real 3D, and red/white H₂O in classification. Desktop and mobile menu width readbacks were also checked by the builder. Updated production screenshots are under `output/playwright/quality-*`; older review images remain available. Temporary development/screenshot tabs and the private development server were closed. The production preview remains on port 5199.
