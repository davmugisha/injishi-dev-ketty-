import {
  collidingLabels,
  isRoomLabelCollision,
  labelKey,
  numberedLabels,
} from './room-labels';

describe('room labels', () => {
  it('compares labels the way a person reads a door', () => {
    expect(labelKey('  Room   12 ')).toBe('room 12');
    expect(labelKey('ROOM 12')).toBe(labelKey('room 12'));
  });

  it('numbers unnamed rooms after the room type, continuing past existing ones', () => {
    expect(numberedLabels('Deluxe  Double', 3)).toEqual([
      'Deluxe Double 1',
      'Deluxe Double 2',
      'Deluxe Double 3',
    ]);
    expect(numberedLabels('Tent', 2, 4)).toEqual(['Tent 5', 'Tent 6']);
  });

  it('finds a label repeated inside one request', () => {
    expect(collidingLabels(['101', '102', '101 '], [])).toEqual(['101']);
  });

  it('finds a label already on another door of the property', () => {
    expect(collidingLabels(['101', 'B2'], ['b2', null, '305'])).toEqual(['B2']);
  });

  it('passes a clean set', () => {
    expect(collidingLabels(['101', '102'], ['201', null])).toEqual([]);
  });
  it('reads a lost race on rooms_property_label_uk as a label collision, wrapped or not', () => {
    const driver = { code: '23505', constraint: 'rooms_property_label_uk' };
    expect(isRoomLabelCollision(driver)).toBe(true);
    expect(isRoomLabelCollision(Object.assign(new Error('query failed'), { cause: driver }))).toBe(true);
  });

  it('does not read any other unique violation as a label collision', () => {
    expect(isRoomLabelCollision({ code: '23505', constraint: 'rooms_pkey' })).toBe(false);
    expect(isRoomLabelCollision({ code: '23503', constraint: 'rooms_property_label_uk' })).toBe(false);
    expect(isRoomLabelCollision(null)).toBe(false);
  });
});
