export type MixturesMode = 'classify' | 'separate' | 'culture' | 'industrial';
export type MixturesFocus = 'entities' | 'purity' | 'properties' | 'investigation';
export type Classification = 'element' | 'compound' | 'mixture' | 'empty';
export type ParticleEntity = 'atom' | 'molecule' | 'ion' | 'grain';
export type ParticlePhase = 'solid' | 'liquid' | 'gas';

export interface SampleConstituent {
  readonly substanceId: string;
  readonly name: string;
  readonly formula: string;
  readonly category: 'element' | 'compound';
  readonly entity: ParticleEntity;
  readonly phase: ParticlePhase;
  readonly count: number;
  readonly colour: string;
  readonly size: number;
}

export interface CompositionSample {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly constituents: readonly SampleConstituent[];
}

const substance = (
  substanceId: string,
  name: string,
  formula: string,
  category: 'element' | 'compound',
  entity: ParticleEntity,
  phase: ParticlePhase,
  count: number,
  colour: string,
  size = 0.12,
): SampleConstituent => ({ substanceId, name, formula, category, entity, phase, count, colour, size });

export const COMPOSITION_SAMPLES: readonly CompositionSample[] = [
  {
    id: 'oxygen', name: 'Oxygen gas', description: 'Each particle is a molecule with two oxygen atoms. One kind of element can be molecular.',
    constituents: [substance('oxygen', 'Oxygen', 'O₂', 'element', 'molecule', 'gas', 18, '#e43d39', 0.12)],
  },
  {
    id: 'argon', name: 'Argon gas', description: 'Each particle is one argon atom. This pure element is monatomic.',
    constituents: [substance('argon', 'Argon', 'Ar', 'element', 'atom', 'gas', 18, '#205fe8', 0.105)],
  },
  {
    id: 'water', name: 'Pure water', description: 'Every particle is an H₂O molecule: a compound made from chemically bonded elements.',
    constituents: [substance('water', 'Water', 'H₂O', 'compound', 'molecule', 'liquid', 18, '#e43d39', 0.13)],
  },
  {
    id: 'carbon-dioxide', name: 'Carbon dioxide gas', description: 'Each particle has one carbon atom bonded to two oxygen atoms. It is one compound substance.',
    constituents: [substance('carbon-dioxide', 'Carbon dioxide', 'CO₂', 'compound', 'molecule', 'gas', 18, '#303844', 0.09)],
  },
  {
    id: 'salt-crystal', name: 'Sodium chloride crystal', description: 'The crystal contains sodium and chloride ions arranged in one ionic compound.',
    constituents: [
      substance('sodium-chloride', 'Sodium chloride', 'Na⁺', 'compound', 'ion', 'solid', 9, '#efb317', 0.105),
      substance('sodium-chloride', 'Sodium chloride', 'Cl⁻', 'compound', 'ion', 'solid', 9, '#7055dc', 0.115),
    ],
  },
  {
    id: 'salt-water', name: 'Salt water', description: 'Water molecules and dissolved sodium and chloride ions share one sample without becoming a new compound.',
    constituents: [
      substance('water', 'Water', 'H₂O', 'compound', 'molecule', 'liquid', 10, '#e43d39', 0.12),
      substance('sodium-chloride', 'Sodium chloride', 'Na⁺', 'compound', 'ion', 'liquid', 4, '#efb317', 0.095),
      substance('sodium-chloride', 'Sodium chloride', 'Cl⁻', 'compound', 'ion', 'liquid', 4, '#7055dc', 0.105),
    ],
  },
  {
    id: 'sand-salt', name: 'Sand and salt', description: 'Silica grains and sodium chloride crystals are two substances physically mixed together.',
    constituents: [
      substance('silica', 'Silica', 'SiO₂', 'compound', 'grain', 'solid', 10, '#205fe8', 0.16),
      substance('sodium-chloride', 'Sodium chloride', 'NaCl', 'compound', 'grain', 'solid', 8, '#efb317', 0.11),
    ],
  },
  {
    id: 'air', name: 'Air sample', description: 'Nitrogen and oxygen molecules plus argon atoms are different substances in a gas mixture.',
    constituents: [
      substance('nitrogen', 'Nitrogen', 'N₂', 'element', 'molecule', 'gas', 8, '#3976df', 0.11),
      substance('oxygen', 'Oxygen', 'O₂', 'element', 'molecule', 'gas', 8, '#e43d39', 0.12),
      substance('argon', 'Argon', 'Ar', 'element', 'atom', 'gas', 2, '#07aabd', 0.09),
    ],
  },
] as const;

export function compositionSample(id: string): CompositionSample {
  return COMPOSITION_SAMPLES.find((sample) => sample.id === id) ?? COMPOSITION_SAMPLES[0];
}

export function classifyComposition(sample: CompositionSample): Classification {
  const substances = new Map<string, SampleConstituent>();
  for (const constituent of sample.constituents) {
    if (constituent.count > 0) substances.set(constituent.substanceId, constituent);
  }
  if (substances.size === 0) return 'empty';
  if (substances.size > 1) return 'mixture';
  return [...substances.values()][0].category;
}

export function classificationExplanation(classification: Classification): string {
  switch (classification) {
    case 'element': return 'One kind of atom is present. It may appear as individual atoms or as molecules made from that same element.';
    case 'compound': return 'One chemically bonded substance is present. Its particles contain more than one element.';
    case 'mixture': return 'Two or more substances are together without all becoming chemically bonded into one new substance.';
    case 'empty': return 'Add a sample before classifying it. An empty container is not a pure substance.';
  }
}

export interface DisplayParticle {
  readonly id: string;
  readonly substanceId: string;
  readonly label: string;
  readonly formula: string;
  readonly entity: ParticleEntity;
  readonly phase: ParticlePhase;
  readonly colour: string;
  readonly position: readonly [number, number, number];
  readonly radius: number;
}

function unit(seed: number): number {
  const value = Math.sin(seed * 91.73 + 13.37) * 43758.5453;
  return value - Math.floor(value);
}

export function particlesForComposition(sample: CompositionSample, modelTimeSeconds = 0): DisplayParticle[] {
  const particles: DisplayParticle[] = [];
  if (sample.id === 'salt-crystal') {
    const sodium = sample.constituents.find((constituent) => constituent.formula === 'Na⁺');
    const chloride = sample.constituents.find((constituent) => constituent.formula === 'Cl⁻');
    if (sodium && chloride) {
      for (let layer = 0; layer < 2; layer += 1) {
        for (let row = 0; row < 3; row += 1) {
          for (let column = 0; column < 3; column += 1) {
            const ion = (layer + row + column) % 2 === 0 ? sodium : chloride;
            const position: readonly [number, number, number] = [(column - 1) * 0.34, (layer - 0.5) * 0.28, (row - 1) * 0.34];
            particles.push({
              id: `salt-crystal-${ion.formula}-${layer}-${row}-${column}`,
              substanceId: ion.substanceId,
              label: ion.name,
              formula: ion.formula,
              entity: ion.entity,
              phase: ion.phase,
              colour: ion.colour,
              position,
              radius: ion.size,
            });
          }
        }
      }
      return particles;
    }
  }
  sample.constituents.forEach((constituent, groupIndex) => {
    for (let index = 0; index < Math.max(0, Math.floor(constituent.count)); index += 1) {
      const idSeed = groupIndex * 64 + index + 1;
      const gas = constituent.phase === 'gas';
      const radial = Math.sqrt(unit(idSeed * 1.1)) * (gas ? 0.52 : 0.5);
      const angle = unit(idSeed * 1.7) * Math.PI * 2 + (gas ? modelTimeSeconds * (0.14 + unit(idSeed) * 0.12) : 0);
      const rawY = gas
        ? -0.64 + unit(idSeed * 2.3) * 1.3 + Math.sin(modelTimeSeconds * 0.55 + idSeed) * 0.02
        : constituent.phase === 'solid'
          ? -0.7 + unit(idSeed * 2.3) * 0.62 + (index % 3) * 0.025
          : -0.58 + unit(idSeed * 2.3) * 1.06;
      const margin = Math.max(0.16, constituent.size * 1.3);
      const y = Math.max(-0.89 + margin, Math.min(0.89 - margin, rawY));
      particles.push({
        id: `${sample.id}-${groupIndex}-${index}`,
        substanceId: constituent.substanceId,
        label: constituent.name,
        formula: constituent.formula,
        entity: constituent.entity,
        phase: constituent.phase,
        colour: constituent.colour,
        position: [Math.cos(angle) * radial, y, Math.sin(angle) * radial * 0.5],
        radius: constituent.size,
      });
    }
  });
  return particles;
}

export type SeparationMixtureId = 'iron-sand' | 'gravel-sand' | 'sand-salt-water' | 'oil-water' | 'iron-sand-salt';
export type SeparationTechnique = 'sieve' | 'magnet' | 'settle-decant' | 'filter' | 'evaporate' | 'distill' | 'dissolve';
export type SeparationMaterialId = 'water' | 'oil' | 'iron' | 'gravel' | 'sand' | 'salt' | 'sugar' | 'debris' | 'sediment' | 'dissolved-salt';

export interface SeparationMaterial {
  readonly id: SeparationMaterialId;
  readonly name: string;
  readonly colour: string;
  readonly phase: ParticlePhase;
  readonly densityGPerMl: number;
  readonly grainSizeMm: number;
  readonly magnetic: boolean;
  readonly solubleInWater: boolean;
  readonly volatile: boolean;
  readonly suspended: boolean;
}

export const SEPARATION_MATERIALS: Readonly<Record<SeparationMaterialId, SeparationMaterial>> = {
  water: { id: 'water', name: 'Water', colour: '#07aabd', phase: 'liquid', densityGPerMl: 1, grainSizeMm: 0, magnetic: false, solubleInWater: false, volatile: true, suspended: false },
  oil: { id: 'oil', name: 'Oil (nonvolatile model)', colour: '#d9a21b', phase: 'liquid', densityGPerMl: 0.9, grainSizeMm: 0, magnetic: false, solubleInWater: false, volatile: false, suspended: false },
  iron: { id: 'iron', name: 'Iron filings', colour: '#4b525d', phase: 'solid', densityGPerMl: 7.8, grainSizeMm: 0.3, magnetic: true, solubleInWater: false, volatile: false, suspended: true },
  gravel: { id: 'gravel', name: 'Gravel', colour: '#8d9096', phase: 'solid', densityGPerMl: 2.65, grainSizeMm: 4, magnetic: false, solubleInWater: false, volatile: false, suspended: true },
  sand: { id: 'sand', name: 'Sand', colour: '#d9bd82', phase: 'solid', densityGPerMl: 2.65, grainSizeMm: 0.4, magnetic: false, solubleInWater: false, volatile: false, suspended: true },
  salt: { id: 'salt', name: 'Salt crystals', colour: '#e9f1f8', phase: 'solid', densityGPerMl: 2.16, grainSizeMm: 0.2, magnetic: false, solubleInWater: true, volatile: false, suspended: false },
  sugar: { id: 'sugar', name: 'Sugar crystals', colour: '#f4e6ee', phase: 'solid', densityGPerMl: 1.59, grainSizeMm: 0.3, magnetic: false, solubleInWater: true, volatile: false, suspended: false },
  debris: { id: 'debris', name: 'Large debris', colour: '#8a6a43', phase: 'solid', densityGPerMl: 0.6, grainSizeMm: 8, magnetic: false, solubleInWater: false, volatile: false, suspended: true },
  sediment: { id: 'sediment', name: 'Suspended sediment', colour: '#a58c63', phase: 'solid', densityGPerMl: 2.3, grainSizeMm: 0.05, magnetic: false, solubleInWater: false, volatile: false, suspended: true },
  'dissolved-salt': { id: 'dissolved-salt', name: 'Dissolved salt', colour: '#8c58d9', phase: 'liquid', densityGPerMl: 2.16, grainSizeMm: 0, magnetic: false, solubleInWater: true, volatile: false, suspended: false },
};

const MIXTURE_FEEDS: Readonly<Record<SeparationMixtureId, Readonly<Partial<Record<SeparationMaterialId, number>>>>> = {
  'iron-sand': { iron: 24, sand: 76 },
  'gravel-sand': { gravel: 42, sand: 58 },
  'sand-salt-water': { water: 100, sand: 28, 'dissolved-salt': 12 },
  'oil-water': { oil: 24, water: 76 },
  'iron-sand-salt': { iron: 15, sand: 40, salt: 20 },
};

/** Water added by the dissolve step of the guided investigation. */
export const ADDED_WATER_G = 100;

export interface SeparationOutput {
  readonly label: string;
  readonly technique?: SeparationTechnique;
  readonly massesG: Readonly<Partial<Record<SeparationMaterialId, number>>>;
}

export interface SeparationState {
  readonly mixtureId: SeparationMixtureId;
  readonly remainingG: Readonly<Partial<Record<SeparationMaterialId, number>>>;
  readonly outputs: readonly SeparationOutput[];
  readonly steps: readonly SeparationTechnique[];
  /** Water added from outside by the dissolve step (counted in the conserved total). */
  readonly addedWaterG: number;
  readonly lastAction: Readonly<{ technique: SeparationTechnique; label: string; movedG: number; note?: string }> | null;
}

export const SEPARATION_TECHNIQUES: readonly { id: SeparationTechnique; name: string; property: string }[] = [
  { id: 'sieve', name: 'Sieve', property: 'Particle size' },
  { id: 'magnet', name: 'Magnet', property: 'Magnetism' },
  { id: 'settle-decant', name: 'Settle & decant', property: 'Density, settling and immiscibility' },
  { id: 'filter', name: 'Filter', property: 'Particle size and insolubility' },
  { id: 'evaporate', name: 'Evaporate', property: 'Different volatility' },
  { id: 'distill', name: 'Distil', property: 'Different boiling behaviour' },
  { id: 'dissolve', name: 'Add water & stir', property: 'Solubility in water' },
];

export function createSeparationState(mixtureId: SeparationMixtureId = 'sand-salt-water'): SeparationState {
  return { mixtureId, remainingG: { ...MIXTURE_FEEDS[mixtureId] }, outputs: [], steps: [], addedWaterG: 0, lastAction: null };
}

function outputLabel(method: SeparationTechnique, mixtureId: SeparationMixtureId): string {
  switch (method) {
    case 'sieve': return 'Coarse sieve catch';
    case 'magnet': return 'Magnetic catch';
    case 'settle-decant': return mixtureId === 'sand-salt-water' ? 'Decanted liquid' : 'Separated liquid layer';
    case 'filter': return 'Filter residue';
    case 'evaporate': return 'Water vapour';
    case 'distill': return 'Condensed water';
    case 'dissolve': return 'Salt solution';
  }
}

function massToMove(id: SeparationMaterialId, mass: number, technique: SeparationTechnique, mixtureId: SeparationMixtureId, hasLiquid: boolean): number {
  const material = SEPARATION_MATERIALS[id];
  switch (technique) {
    case 'sieve': return material.grainSizeMm >= 2 ? mass : 0;
    case 'magnet': return material.magnetic ? mass : 0;
    case 'settle-decant':
      if ((mixtureId === 'sand-salt-water' || mixtureId === 'iron-sand-salt') && (id === 'water' || id === 'dissolved-salt')) return mass;
      if (mixtureId === 'oil-water' && id === 'oil') return mass;
      return 0;
    case 'dissolve': return 0;
    case 'filter': return !hasLiquid ? 0 : material.phase === 'solid' && material.suspended && !material.solubleInWater && material.grainSizeMm >= 0.05 ? mass : 0;
    case 'evaporate': return id === 'water' ? mass : 0;
    case 'distill': return id === 'water' ? mass : 0;
  }
}

function totalOf(masses: Readonly<Partial<Record<SeparationMaterialId, number>>>): number {
  return Object.values(masses).reduce<number>((sum, mass) => sum + (mass ?? 0), 0);
}

function techniqueNote(before: SeparationState, after: SeparationState, technique: SeparationTechnique, movedG: number): string | undefined {
  const waterBefore = before.remainingG.water ?? 0;
  switch (technique) {
    case 'dissolve':
      if (waterBefore > 0) return 'Water has already been added and the salt is dissolved.';
      if ((before.remainingG.salt ?? 0) + (before.remainingG['dissolved-salt'] ?? 0) <= 0) return 'There are no salt crystals in this sample to dissolve.';
      return `Salt dissolved in ${ADDED_WATER_G} g of added water. Sand and iron do not dissolve, so they stay as solids. The salt is still there, now as dispersed ions.`;
    case 'filter':
      if (waterBefore <= 0) return 'Filtering needs a liquid to carry the dissolved substance through the paper. With no water, nothing is separated. Dissolve the salt first.';
      if ((after.outputs.at(-1)?.massesG.iron ?? 0) > 0 && movedG > 0 && (after.outputs.at(-1)?.massesG.sand ?? 0) > 0) return 'Iron filings were caught on the paper with the sand. A magnet used earlier would have recovered them separately.';
      return undefined;
    case 'evaporate':
      if (waterBefore <= 0) return 'There is no liquid water left to evaporate.';
      if ((after.remainingG.sand ?? 0) > 0) return 'Water left as vapour, but the sand is still mixed in with the salt. Filter before evaporating.';
      if ((after.remainingG.iron ?? 0) > 0) return 'Water left as vapour, but iron filings are still mixed in with the salt. Use the magnet first.';
      return 'Water left as vapour. The dissolved salt stays behind in the basin and forms crystals.';
    case 'magnet':
      return (before.remainingG.iron ?? 0) > 0 ? undefined : 'There is no iron left for the magnet to attract.';
    default:
      return undefined;
  }
}

/** Move only the constituents separated by the selected physical property. */
export function applySeparationTechnique(state: SeparationState, technique: SeparationTechnique): SeparationState {
  if (technique === 'dissolve') {
    const dry = (state.remainingG.water ?? 0) <= 0;
    // Salt left behind by evaporation is dry crystals again, so it can be redissolved.
    const salt = (state.remainingG.salt ?? 0) + (dry ? (state.remainingG['dissolved-salt'] ?? 0) : 0);
    const canDissolve = salt > 0 && dry;
    const remaining: Partial<Record<SeparationMaterialId, number>> = { ...state.remainingG };
    if (canDissolve) {
      remaining.salt = 0;
      remaining['dissolved-salt'] = salt;
      remaining.water = ADDED_WATER_G;
    }
    const label = outputLabel('dissolve', state.mixtureId);
    const next: SeparationState = { ...state, remainingG: remaining, addedWaterG: state.addedWaterG + (canDissolve ? ADDED_WATER_G : 0), steps: [...state.steps, technique], lastAction: { technique, label, movedG: 0 } };
    return { ...next, lastAction: { technique, label, movedG: 0, note: techniqueNote(state, next, technique, 0) } };
  }
  const remaining: Partial<Record<SeparationMaterialId, number>> = { ...state.remainingG };
  const moved: Partial<Record<SeparationMaterialId, number>> = {};
  const hasLiquid = (state.remainingG.water ?? 0) > 0;
  for (const [rawId, rawMass] of Object.entries(remaining)) {
    if (!rawId || rawMass === undefined || rawMass <= 0) continue;
    const id = rawId as SeparationMaterialId;
    const amount = Math.min(rawMass, massToMove(id, rawMass, technique, state.mixtureId, hasLiquid));
    if (amount <= 0) continue;
    moved[id] = amount;
    remaining[id] = Math.max(0, rawMass - amount);
  }
  const movedG = totalOf(moved);
  const label = outputLabel(technique, state.mixtureId);
  const next: SeparationState = {
    ...state,
    remainingG: remaining,
    outputs: Object.keys(moved).length > 0 ? [...state.outputs, { label, technique, massesG: moved }] : state.outputs,
    steps: [...state.steps, technique],
    lastAction: { technique, label, movedG },
  };
  return { ...next, lastAction: { technique, label, movedG, note: techniqueNote(state, next, technique, movedG) } };
}

export function separationMassG(state: SeparationState): number {
  const remaining = Object.values(state.remainingG).reduce<number>((sum, mass) => sum + (mass ?? 0), 0);
  const recovered = state.outputs.reduce((sum, output) => sum + Object.values(output.massesG).reduce<number>((subtotal, mass) => subtotal + (mass ?? 0), 0), 0);
  return remaining + recovered;
}

/** Feed mass plus any water added during the investigation. Equals separationMassG(state) at every step. */
export function separationExpectedMassG(state: SeparationState): number {
  return separationFeedMassG(state.mixtureId) + state.addedWaterG;
}

export interface SeparationInvestigationReport {
  readonly ironG: number;
  readonly sandG: number;
  readonly saltG: number;
  readonly ironPure: boolean;
  readonly sandPure: boolean;
  readonly saltPure: boolean;
  readonly complete: boolean;
  readonly issues: readonly string[];
}

/** Judge the three products of the iron + sand + salt challenge: magnetic catch, filter residue, dry salt in the basin. */
export function investigationReport(state: SeparationState): SeparationInvestigationReport {
  const feed = MIXTURE_FEEDS['iron-sand-salt'];
  const outputsFor = (technique: SeparationTechnique) => state.outputs.filter((output) => output.technique === technique);
  const sum = (outputs: readonly SeparationOutput[], pick: (id: SeparationMaterialId) => boolean) => outputs.reduce((total, output) => total + Object.entries(output.massesG).reduce((subtotal, [id, mass]) => pick(id as SeparationMaterialId) ? subtotal + (mass ?? 0) : subtotal, 0), 0);
  const magnet = outputsFor('magnet');
  const filter = outputsFor('filter');
  const ironG = sum(magnet, (id) => id === 'iron');
  const ironOther = sum(magnet, (id) => id !== 'iron');
  const sandG = sum(filter, (id) => id === 'sand');
  const sandOther = sum(filter, (id) => id !== 'sand');
  const driedOut = (state.remainingG.water ?? 0) <= 0;
  const saltG = driedOut ? (state.remainingG.salt ?? 0) + (state.remainingG['dissolved-salt'] ?? 0) : 0;
  const saltOther = driedOut ? (state.remainingG.sand ?? 0) + (state.remainingG.iron ?? 0) : 0;
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const ironPure = near(ironG, feed.iron ?? 0) && ironOther < 1e-6;
  const sandPure = near(sandG, feed.sand ?? 0) && sandOther < 1e-6;
  const saltPure = near(saltG, feed.salt ?? 0) && saltOther < 1e-6;
  const issues: string[] = [];
  if (sandOther > 0) issues.push(`${sandOther.toFixed(0)} g of iron is caught in the sand residue.`);
  if (saltOther > 0) issues.push(`${saltOther.toFixed(0)} g of sand or iron is mixed into the salt.`);
  if (ironOther > 0) issues.push(`${ironOther.toFixed(0)} g of other material came off with the magnet.`);
  return { ironG, sandG, saltG, ironPure, sandPure, saltPure, complete: ironPure && sandPure && saltPure, issues };
}

export function separationFeedMassG(mixtureId: SeparationMixtureId): number {
  return Object.values(MIXTURE_FEEDS[mixtureId]).reduce<number>((sum, mass) => sum + (mass ?? 0), 0);
}

export interface YandyingState {
  readonly tiltDegrees: number;
  readonly shakeSeconds: number;
  readonly seedMassG: number;
  readonly chaffMassG: number;
  readonly seedSizeMm: number;
  readonly seedDensityGPerMl: number;
  readonly chaffSizeMm: number;
  readonly chaffDensityGPerMl: number;
  readonly recoveredSeedG: number;
  readonly separatedChaffG: number;
}

export interface YandyingParticleProperties { readonly sizeMm: number; readonly densityGPerMl: number }

export const YANDYING_PARTICLE_PROPERTIES: Readonly<{ seed: YandyingParticleProperties; chaff: YandyingParticleProperties }> = {
  seed: { sizeMm: 3, densityGPerMl: 1.15 },
  chaff: { sizeMm: 8, densityGPerMl: 0.28 },
};

/** Relative size and density contrast sets how readily the two marker groups sort. */
export function yandyingSortingEfficiency(
  seed: YandyingParticleProperties = YANDYING_PARTICLE_PROPERTIES.seed,
  chaff: YandyingParticleProperties = YANDYING_PARTICLE_PROPERTIES.chaff,
): number {
  if (![seed.sizeMm, seed.densityGPerMl, chaff.sizeMm, chaff.densityGPerMl].every(Number.isFinite)) return 0;
  if (seed.sizeMm <= 0 || chaff.sizeMm <= 0 || seed.densityGPerMl <= 0 || chaff.densityGPerMl <= 0) return 0;
  const sizeContrast = Math.max(0, (chaff.sizeMm - seed.sizeMm) / Math.max(seed.sizeMm, chaff.sizeMm));
  const densityContrast = Math.max(0, (seed.densityGPerMl - chaff.densityGPerMl) / Math.max(seed.densityGPerMl, chaff.densityGPerMl));
  return Math.min(1, Math.max(0, sizeContrast * 0.55 + densityContrast * 0.45));
}

export function createYandyingState(): YandyingState {
  return { tiltDegrees: 12, shakeSeconds: 0, seedMassG: 80, chaffMassG: 20, seedSizeMm: YANDYING_PARTICLE_PROPERTIES.seed.sizeMm, seedDensityGPerMl: YANDYING_PARTICLE_PROPERTIES.seed.densityGPerMl, chaffSizeMm: YANDYING_PARTICLE_PROPERTIES.chaff.sizeMm, chaffDensityGPerMl: YANDYING_PARTICLE_PROPERTIES.chaff.densityGPerMl, recoveredSeedG: 0, separatedChaffG: 0 };
}

export function setYandyingTilt(state: YandyingState, tiltDegrees: number): YandyingState {
  if (!Number.isFinite(tiltDegrees)) return state;
  const tilt = Math.min(35, Math.max(-35, tiltDegrees));
  return { ...state, tiltDegrees: tilt };
}

export function setYandyingProperties(state: YandyingState, patch: Partial<Pick<YandyingState, 'seedSizeMm' | 'seedDensityGPerMl' | 'chaffSizeMm' | 'chaffDensityGPerMl'>>): YandyingState {
  const next = { ...state, ...patch };
  const valid = [next.seedSizeMm, next.seedDensityGPerMl, next.chaffSizeMm, next.chaffDensityGPerMl].every(Number.isFinite);
  if (!valid) return state;
  return {
    ...next,
    seedSizeMm: Math.min(12, Math.max(1, next.seedSizeMm)),
    seedDensityGPerMl: Math.min(2, Math.max(0.1, next.seedDensityGPerMl)),
    chaffSizeMm: Math.min(12, Math.max(1, next.chaffSizeMm)),
    chaffDensityGPerMl: Math.min(2, Math.max(0.1, next.chaffDensityGPerMl)),
  };
}

/** Schematic separation in an unadorned dish: repeated shaking and tilt sort by size and density. */
export function advanceYandying(state: YandyingState, seconds = 1): YandyingState {
  if (!Number.isFinite(seconds) || seconds <= 0) return state;
  const shakeSeconds = Math.min(30, state.shakeSeconds + seconds);
  const motionDose = Math.min(3, (shakeSeconds / 8) * (Math.abs(state.tiltDegrees) / 24));
  const sortingEfficiency = yandyingSortingEfficiency(
    { sizeMm: state.seedSizeMm, densityGPerMl: state.seedDensityGPerMl },
    { sizeMm: state.chaffSizeMm, densityGPerMl: state.chaffDensityGPerMl },
  );
  const energy = Math.min(1, motionDose * sortingEfficiency);
  const recoveredSeedG = Math.min(state.seedMassG, state.seedMassG * energy * 0.84);
  const separatedChaffG = Math.min(state.chaffMassG, state.chaffMassG * energy * 0.94);
  return { ...state, shakeSeconds, recoveredSeedG, separatedChaffG };
}

export function yandyingMassLedger(state: YandyingState) {
  return {
    totalG: state.seedMassG + state.chaffMassG,
    recoveredSeedG: state.recoveredSeedG,
    remainingSeedG: Math.max(0, state.seedMassG - state.recoveredSeedG),
    separatedChaffG: state.separatedChaffG,
    remainingChaffG: Math.max(0, state.chaffMassG - state.separatedChaffG),
  };
}

export type IndustrialStage = 'screen' | 'flocculate' | 'filter';

export interface IndustrialWaterState {
  readonly waterMassG: number;
  readonly debrisG: number;
  readonly sedimentG: number;
  readonly dissolvedSaltG: number;
  readonly coagulantDosePercent: number;
  readonly wasteDebrisG: number;
  readonly wasteSedimentG: number;
  readonly flocculated: boolean;
  readonly stages: readonly IndustrialStage[];
  /** What each completed stage removed, so the scene can show where waste was caught. */
  readonly stageLog: readonly { readonly stage: IndustrialStage; readonly debrisG: number; readonly sedimentG: number }[];
}

export function createIndustrialWaterState(): IndustrialWaterState {
  return { waterMassG: 1000, debrisG: 12, sedimentG: 35, dissolvedSaltG: 6, coagulantDosePercent: 60, wasteDebrisG: 0, wasteSedimentG: 0, flocculated: false, stages: [], stageLog: [] };
}

export function setIndustrialCoagulantDose(state: IndustrialWaterState, percent: number): IndustrialWaterState {
  if (!Number.isFinite(percent)) return state;
  return { ...state, coagulantDosePercent: Math.min(100, Math.max(0, percent)) };
}

export function industrialWaterMassG(state: IndustrialWaterState): number {
  return state.waterMassG;
}

/** Simplified screening and filtration separate particles; flocculation only gathers suspended sediment. */
export function runIndustrialStage(state: IndustrialWaterState, stage: IndustrialStage): IndustrialWaterState {
  if (stage === 'screen') {
    const debrisMoved = state.debrisG * 0.96;
    const sedimentMoved = state.sedimentG * 0.08;
    return {
      ...state,
      debrisG: state.debrisG - debrisMoved,
      sedimentG: state.sedimentG - sedimentMoved,
      wasteDebrisG: state.wasteDebrisG + debrisMoved,
      wasteSedimentG: state.wasteSedimentG + sedimentMoved,
      stages: [...state.stages, stage],
      stageLog: [...state.stageLog, { stage, debrisG: debrisMoved, sedimentG: sedimentMoved }],
    };
  }
  if (stage === 'flocculate') return { ...state, flocculated: true, stages: [...state.stages, stage], stageLog: [...state.stageLog, { stage, debrisG: 0, sedimentG: 0 }] };
  const sedimentFraction = state.flocculated ? 0.28 + state.coagulantDosePercent * 0.006 : 0.46;
  const sedimentMoved = state.sedimentG * sedimentFraction;
  const debrisMoved = state.debrisG * 0.2;
  return {
    ...state,
    debrisG: state.debrisG - debrisMoved,
    sedimentG: state.sedimentG - sedimentMoved,
    wasteDebrisG: state.wasteDebrisG + debrisMoved,
    wasteSedimentG: state.wasteSedimentG + sedimentMoved,
    stages: [...state.stages, stage],
    stageLog: [...state.stageLog, { stage, debrisG: debrisMoved, sedimentG: sedimentMoved }],
  };
}

export function industrialPollutantLedger(state: IndustrialWaterState) {
  return {
    debrisTotalG: state.debrisG + state.wasteDebrisG,
    sedimentTotalG: state.sedimentG + state.wasteSedimentG,
    dissolvedSaltTotalG: state.dissolvedSaltG,
    remainingSuspendedG: state.debrisG + state.sedimentG,
    inputPollutantsG: state.debrisG + state.wasteDebrisG + state.sedimentG + state.wasteSedimentG + state.dissolvedSaltG,
  };
}

export function createMixturesState(mode: MixturesMode = 'classify') {
  return { mode, sampleId: 'oxygen' as const };
}
