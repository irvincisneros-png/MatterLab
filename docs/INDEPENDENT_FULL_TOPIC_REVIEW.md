# Full-topic independent review

Scope: the nineteen outcomes supplied by the user, plus the requested Lexend typography and replacement of beige UI surfaces. This review is separate from the builders' handover and concerns working virtual lesson activities; it does not certify that physical practical investigations have been conducted by students.

## Scientific review

The parent reviewed the water, solutions, mixtures and pollution engines and their apparatus components. Corrections requested during that review include:

- Cloud condensation creates liquid droplets. Cloud freezing and melting are separate transfers; the cycle preserves a one-kilogram tracked water inventory.
- Heater power and accelerated playback time are separate. Neutral buoyancy is distinguished from floating and sinking.
- Solubility uses a fixed solvent mass, with classroom curve approximations disclosed. Unsaturated observations are lower bounds; equilibrium with excess solid is required to record model solubility.
- Concentration is compared between matched samples; saturation is assessed against capacity independently. Cooling an unseeded clear solution and adding a seed have different effects.
- Molecular oxygen and nitrogen have two atoms. Water molecules, monatomic argon, and ionic salt retain their identities.
- The source-grounded yandying example separates smaller, denser seed markers from larger, lighter pod/chaff markers. Illustrative properties and efficiencies are not represented as cultural measurements.
- Industrial coagulation/flocculation is distinguished from physical screening and filtration. Dissolved salt remains after physical filtration.
- Decanting pours off upper water and carries dissolved salt with it. Recovered water, pollutant recovery, retained material and waste are separately accounted. Mass-error diagnostics preserve their sign.
- Pollution trials support matched starting samples, a prediction, elapsed model time, tables and a graph. Transferring pollution into recovered water is distinct from removing it to waste.

The cultural attribution was reviewed against ACARA's public Year 7 teacher background: the Yindjibarni word from the Pilbara and the Yankunytjatjara double-yandying example in north-western South Australia are identified separately. The plain teaching apparatus does not reproduce motifs, claim endorsement, or invent a community account. Industrial context is attributed to Sydney Water's public educational account.

## Verification

The parent independently completed the final checks on 30 September 2026:

- `npm run build`: passed TypeScript and production bundling.
- `npm test`: 70/70 tests passed across eight suites.
- `npm run test:e2e`: 48/48 browser tests passed in 2.7 minutes. These include every canonical outcome route, all nineteen routes at 375 px, investigation workflows, conservation checks, challenges, keyboard/reduced-motion behaviour, and supported/unsupported/lost graphics contexts.
- The actual production preview at `http://127.0.0.1:5199/` was inspected in the Codex in-app browser. The parent verified real 3D scenes, lesson navigation, measurement actions, classification feedback, separation transfers, cultural attribution, industrial screening and a recorded pollution trial.
- Heating at 1 kW changed the 200 g ice model from −20.0 to −17.6 °C after one model second, while its recorded initial reading stayed at time zero. Liquid measurements gave 49.9 g net mass for 50 mL, yielding 998.0 kg/m³ against the named 998.2 kg/m³ reference.
- The matched pollution sample contained 58 g pollutant input. Filtration transferred 30.1 g sediment to waste while leaving 12 g dissolved salt in the body. The recorded table retained the prediction and elapsed model time; its stacked graph reflected the conserved output compartments.
- A final native 375 px check reported document width 375 px and computed Lexend typography. The viewport was restored afterward. The final paperclip lies flat on the modeled water surface. The desktop navigation and primary-button contrast fixes were visually confirmed.

Review images are saved under `output/playwright/`: `full-topic-water-cycle.png`, `full-topic-heating-graph.png`, `full-topic-mixtures-separation.png`, `full-topic-pollution-trial.png`, and `full-topic-mobile-375.png`. The parent inspected the production desktop apparatus and recorded-data images, and inspected the mobile layout directly.

All nineteen requested outcomes now have working virtual activities; the coverage matrix and Guide give their direct entry points. The local preview remains running, and the user-facing tab is left at the States lesson. No external publication or student-data collection was added.

The production bundle has a nonblocking Vite size advisory (about 404 kB gzipped JavaScript). Upstream Three.js Clock/shadow deprecation warnings remain. These checks do not benchmark a school's hardware fleet or turn the declared instructional models into calibrated physical measurements.
