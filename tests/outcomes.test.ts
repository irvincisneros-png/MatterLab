import { describe, expect, it } from 'vitest';
import { OUTCOMES, OUTCOME_IDS, readOutcomeFromHash, routeForOutcome, SYLLABUS_SECTIONS } from '../src/content/outcomes';

describe('direct curriculum lesson routes', () => {
  it('provides a direct hash route for every supplied Term 4 outcome', () => {
    expect(OUTCOME_IDS).toHaveLength(19);
    for (const id of OUTCOME_IDS) {
      expect(readOutcomeFromHash(routeForOutcome(id))).toBe(id);
    }
    expect(readOutcomeFromHash('#/simulators/4.9.9')).toBeNull();
  });

  it('preserves the full supplied wording and implementation coverage state', () => {
    expect(OUTCOMES['4.1.1'].coverage).toBe('included');
    expect(OUTCOMES['4.1.4'].coverage).toBe('included');
    expect(OUTCOMES['4.4.5'].wording).toContain('Aboriginal and/or Torres Strait Islander Peoples');
    expect(OUTCOMES['4.5.1'].wording).toContain('remove the pollutants');
    expect(OUTCOME_IDS.every((id) => OUTCOMES[id].coverage === 'included')).toBe(true);
  });

  it('orders all entries under the supplied syllabus sections, not the app tool groups', () => {
    expect(SYLLABUS_SECTIONS.map((section) => section.title)).toEqual([
      'Properties of matter', 'Properties of water', 'Solutions', 'Separating mixtures', 'Solutions and mixtures in context',
    ]);
    expect(SYLLABUS_SECTIONS.flatMap((section) => section.outcomes)).toEqual(OUTCOME_IDS);
  });
});
