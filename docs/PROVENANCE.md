# Asset and source provenance

## Runtime assets

- Chambers, ice, liquid geometry, water molecules, bonds, lighting and shadows are generated procedurally by Three.js from source code in this project.
- The 2D fallback is HTML/CSS driven by the same science engine.
- Icons come from the locally installed `lucide-react` dependency. Text uses a locally bundled Lexend variable font (Latin and Latin Extended WOFF2 subsets) with system UI fallbacks for unsupported glyphs. The files are from `@fontsource-variable/lexend` 5.3.0; Lexend Project Authors copyright 2019. The font files and SIL Open Font License 1.1 are in [`src/assets/fonts/`](../src/assets/fonts/).
- `public/matterlab.svg` is a small project-authored atom mark.
- There are no remote images, 3D models, textures, fonts, APIs or analytics calls at runtime.
- The optional sucrose particle conformer is a project-bundled copy of the 3D coordinate record for PubChem CID 5988, fetched from the PUG REST 3D JSON record on 1 October 2026. It is a single local geometry, not a runtime call and not a claim about an aqueous molecular conformation. Source: [PubChem sucrose](https://pubchem.ncbi.nlm.nih.gov/compound/5988) · [PUG REST 3D JSON record](https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/5988/JSON?record_type=3d). The locally included atom/bond arrays are in [`src/science/sucroseStructure.ts`](../src/science/sucroseStructure.ts).

## Design palette

The shared interface uses cool white and pale blue surfaces with navy text, saturated cobalt and aqua controls, and intentional coral, violet and gold markers for science states and topics. The rendered apparatus is code-generated; neutral porcelain and cool blue plinths replace the earlier warm-tan materials. No runtime font service or CDN is used.

## Science references

- USGS Water Science School, [Water density](https://www.usgs.gov/water-science-school/science/water-density).
- USGS Water Science School, [Properties of water](https://www.usgs.gov/water-science-school/properties-water).
- American Chemical Society, [Middle School Chemistry: Properties of Matter](https://www.acs.org/middleschoolchemistry/lessonplans/chapter1.html).
- American Chemical Society, [Changing State teacher background](https://www.acs.org/content/dam/acsorg/msc/downloads/chapter-2/lesson-5/ch2-l5-teacher-background.pdf).

Sources guide the stated density, vapour-visibility, attraction and phase-change background. Numerical implementation constants and schematic choices are listed in [Science model and limits](SCIENCE_MODEL.md).
