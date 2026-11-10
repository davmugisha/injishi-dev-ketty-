import { describe, expect, it } from 'vitest';

import { inAudience } from './my-content.service';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const KITCHEN = '33333333-3333-4333-8333-333333333333';
const LAUNDRY = '44444444-4444-4444-8444-444444444444';
const COOK = '55555555-5555-4555-8555-555555555555';
const GUARD = '66666666-6666-4666-8666-666666666666';

const person = { id: ME, jobPositionId: COOK, departmentIds: new Set([KITCHEN]) };
const none = { departmentIds: [], jobPositionIds: [], employeeIds: [] };

describe('inAudience', () => {
  it('always takes a person named', () => {
    expect(inAudience({ ...none, employeeIds: [ME], departmentIds: [LAUNDRY] }, person)).toBe(true);
  });

  it('matches on the department alone or the position alone', () => {
    expect(inAudience({ ...none, departmentIds: [KITCHEN] }, person)).toBe(true);
    expect(inAudience({ ...none, jobPositionIds: [COOK] }, person)).toBe(true);
    expect(inAudience({ ...none, departmentIds: [LAUNDRY] }, person)).toBe(false);
    expect(inAudience({ ...none, jobPositionIds: [GUARD] }, person)).toBe(false);
  });

  it('narrows when a department and a position are named together', () => {
    expect(inAudience({ ...none, departmentIds: [KITCHEN], jobPositionIds: [COOK] }, person)).toBe(true);
    expect(inAudience({ ...none, departmentIds: [KITCHEN], jobPositionIds: [GUARD] }, person)).toBe(false);
    expect(inAudience({ ...none, departmentIds: [LAUNDRY], jobPositionIds: [COOK] }, person)).toBe(false);
  });

  it('leaves out a person with no position when a position is named', () => {
    expect(inAudience({ ...none, jobPositionIds: [COOK] }, { ...person, jobPositionId: null })).toBe(false);
  });

  it('reaches nobody with no targets, or targets naming others', () => {
    expect(inAudience(undefined, person)).toBe(false);
    expect(inAudience(none, person)).toBe(false);
    expect(inAudience({ ...none, employeeIds: [OTHER] }, person)).toBe(false);
  });
});
