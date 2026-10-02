export type OutcomeId =
  | '4.1.1' | '4.1.2' | '4.1.3' | '4.1.4'
  | '4.2.1' | '4.2.2' | '4.2.3'
  | '4.3.1' | '4.3.2' | '4.3.3' | '4.3.4' | '4.3.5'
  | '4.4.1' | '4.4.2' | '4.4.3' | '4.4.4' | '4.4.5' | '4.4.6'
  | '4.5.1';

export type OutcomeTopic = 'water' | 'matter' | 'solutions' | 'mixtures' | 'pollution';
export type OutcomeCoverage = 'included' | 'partial' | 'in-progress';

export interface OutcomeDefinition {
  readonly wording: string;
  readonly topic: OutcomeTopic;
  readonly coverage: OutcomeCoverage;
  readonly focus: string;
}

export const OUTCOME_IDS: readonly OutcomeId[] = [
  '4.1.1', '4.1.2', '4.1.3', '4.1.4', '4.2.1', '4.2.2', '4.2.3',
  '4.3.1', '4.3.2', '4.3.3', '4.3.4', '4.3.5',
  '4.4.1', '4.4.2', '4.4.3', '4.4.4', '4.4.5', '4.4.6', '4.5.1',
];

export const OUTCOME_SHORT_TITLES: Readonly<Record<OutcomeId, string>> = {
  '4.1.1': 'Water through the Earth system',
  '4.1.2': 'Heat and measure water',
  '4.1.3': 'Changes of state',
  '4.1.4': 'How states behave',
  '4.2.1': 'Water’s physical properties',
  '4.2.2': 'Measure liquid density',
  '4.2.3': 'Measure object density',
  '4.3.1': 'What dissolves?',
  '4.3.2': 'Measure solubility',
  '4.3.3': 'Temperature and solubility',
  '4.3.4': 'Solutions as particles',
  '4.3.5': 'Compare solution states',
  '4.4.1': 'Atoms, mixtures and compounds',
  '4.4.2': 'Classify samples',
  '4.4.3': 'Separate by physical properties',
  '4.4.4': 'Investigate separation methods',
  '4.4.5': 'Yandying investigation',
  '4.4.6': 'Industrial water filtration',
  '4.5.1': 'Pollute and treat a water body',
};

export const SYLLABUS_SECTIONS: readonly { id: '4.1' | '4.2' | '4.3' | '4.4' | '4.5'; title: string; outcomes: readonly OutcomeId[] }[] = [
  { id: '4.1', title: 'Properties of matter', outcomes: ['4.1.1', '4.1.2', '4.1.3', '4.1.4'] },
  { id: '4.2', title: 'Properties of water', outcomes: ['4.2.1', '4.2.2', '4.2.3'] },
  { id: '4.3', title: 'Solutions', outcomes: ['4.3.1', '4.3.2', '4.3.3', '4.3.4', '4.3.5'] },
  { id: '4.4', title: 'Separating mixtures', outcomes: ['4.4.1', '4.4.2', '4.4.3', '4.4.4', '4.4.5', '4.4.6'] },
  { id: '4.5', title: 'Solutions and mixtures in context', outcomes: ['4.5.1'] },
];

export const OUTCOMES: Readonly<Record<OutcomeId, OutcomeDefinition>> = {
  '4.1.1': {
    wording: 'Identify the 3 main states of matter and how they are represented in the movement of water on earth',
    topic: 'water', coverage: 'included', focus: 'Trace model water through ice, liquid water, vapour, clouds and precipitation.',
  },
  '4.1.2': {
    wording: 'Conduct an investigation to measure and graph the temperature of water to identify the changes of state as heated over time',
    topic: 'water', coverage: 'included', focus: 'Heat water through model time; choose measurement equipment, record trials and graph temperature.',
  },
  '4.1.3': {
    wording: 'Represent changes in the state of matter in terms of particle arrangement and movement',
    topic: 'matter', coverage: 'included', focus: 'Add or remove energy and follow particle arrangement through phase change.',
  },
  '4.1.4': {
    wording: 'Compare the properties of matter in different states, including the relative strength of attractive forces between solid, liquid and gas particles, to explain differences in the behaviours of the 3 states of matter',
    topic: 'matter', coverage: 'included', focus: 'Compare shape, particle movement and qualitative relative attraction.',
  },
  '4.2.1': {
    wording: 'Investigate the other physical properties of water, such as density, buoyancy and surface tension',
    topic: 'water', coverage: 'included', focus: 'Test density, displacement, floating and a qualitative surface-tension model as distinct properties.',
  },
  '4.2.2': {
    wording: 'Conduct a practical investigation and select appropriate equipment to measure the density of water and other substances, and record the results in a table to compare the calculated density with SI data',
    topic: 'water', coverage: 'included', focus: 'Select balance and volume equipment, calculate density and compare with sourced SI values.',
  },
  '4.2.3': {
    wording: 'Determine the volume and mass of regular-shaped and irregular-shaped objects to calculate their density using the formula image',
    topic: 'water', coverage: 'included', focus: 'Measure regular dimensions or irregular displacement and use density = mass / volume.',
  },
  '4.3.1': {
    wording: 'Investigate what substances dissolve in water and discuss findings using key terms, including soluble, insoluble, solubility, solute, solvent and solution',
    topic: 'solutions', coverage: 'included', focus: 'Add soluble and insoluble materials to water; identify solute, solvent and solution.',
  },
  '4.3.2': {
    wording: 'Conduct and document a practical investigation to measure solubility of different solutes in water, and present data using tables and relevant graphs',
    topic: 'solutions', coverage: 'included', focus: 'Measure equilibrium dissolved mass over matched solvent quantities, record trials and graph the results.',
  },
  '4.3.3': {
    wording: 'Qualitatively investigate the effect of temperature on solubility',
    topic: 'solutions', coverage: 'included', focus: 'Compare substance-specific dissolution capacity at controlled temperatures.',
  },
  '4.3.4': {
    wording: 'Describe how solutions can be modelled using particle theory',
    topic: 'solutions', coverage: 'included', focus: 'Inspect solvent particles surrounding dispersed solute particles or ions.',
  },
  '4.3.5': {
    wording: 'Compare the properties of dilute, concentrated, saturated and supersaturated solutions',
    topic: 'solutions', coverage: 'included', focus: 'Compare concentration with capacity; cool a seed-free supersaturated solution and trigger crystallisation.',
  },
  '4.4.1': {
    wording: 'Distinguish between atoms, mixtures and compounds and explain their properties using particle theory',
    topic: 'mixtures', coverage: 'included', focus: 'Inspect atom, molecule and ion markers in compounds and physically mixed samples.',
  },
  '4.4.2': {
    wording: 'Classify matter as pure substances, including elements and compounds, and impure substances, including mixtures based on their particle composition',
    topic: 'mixtures', coverage: 'included', focus: 'Classify one element or compound substance against samples containing multiple substances.',
  },
  '4.4.3': {
    wording: 'Explain how the physical properties of substances are used to separate mixtures',
    topic: 'mixtures', coverage: 'included', focus: 'Choose size, magnetism, density, insolubility or volatility to separate a sample.',
  },
  '4.4.4': {
    wording: 'Conduct a series of practical investigations to explore common techniques to separate mixtures',
    topic: 'mixtures', coverage: 'included', focus: 'Try and record repeatable mixture separation methods and their recovered outputs.',
  },
  '4.4.5': {
    wording: 'Investigate techniques used by Aboriginal and/or Torres Strait Islander Peoples to separate mixtures',
    topic: 'mixtures', coverage: 'included', focus: 'Explore source-grounded yandying context and test size/density sorting in a generic dish.',
  },
  '4.4.6': {
    wording: 'Investigate an industrial separation technique',
    topic: 'mixtures', coverage: 'included', focus: 'Model Sydney Water screening, flocculation and filter media with waste and dissolved mass tracked.',
  },
  '4.5.1': {
    wording: 'Model how a body of water can become polluted, and plan and conduct a practical investigation that attempts to remove the pollutants',
    topic: 'pollution', coverage: 'included', focus: 'Add floating, suspended and dissolved pollutants; plan matched removal trials and compare outcomes.',
  },
};

export const TOPIC_GROUPS: readonly { id: OutcomeTopic; label: string; firstOutcome: OutcomeId }[] = [
  { id: 'water', label: 'Water', firstOutcome: '4.1.1' },
  { id: 'matter', label: 'Matter', firstOutcome: '4.1.4' },
  { id: 'solutions', label: 'Solutions', firstOutcome: '4.3.1' },
  { id: 'mixtures', label: 'Mixtures', firstOutcome: '4.4.1' },
  { id: 'pollution', label: 'Water pollution', firstOutcome: '4.5.1' },
];

export function readOutcomeFromHash(hash: string): OutcomeId | null {
  const match = hash.match(/(?:^#?\/simulators\/)(4\.[1-5]\.[1-6])(?:\/|$)/);
  return match && match[1] in OUTCOMES ? (match[1] as OutcomeId) : null;
}

export function routeForOutcome(outcome: OutcomeId): string {
  return `#/simulators/${outcome}`;
}
