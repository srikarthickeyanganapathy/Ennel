import { buildMonth, monthTitle, shiftMonth } from './calendar';
import { describeRule, describeWeekdays } from './weekdays';

describe('buildMonth (Spec §6.1 calendar)', () => {
  it('lays out a month Sunday-first and allows only dates in the booking period', () => {
    const weeks = buildMonth('2026-10', { today: '2026-10-24', lastDate: '2026-11-07' });
    // 1 October 2026 is a Thursday.
    expect(weeks[0]?.slice(0, 4)).toEqual([null, null, null, null]);
    expect(weeks[0]?.[4]).toMatchObject({ date: '2026-10-01', isSelectable: false });
    const cells = weeks.flat().filter((cell) => cell !== null);
    expect(cells).toHaveLength(31);
    expect(cells.find((cell) => cell.date === '2026-10-24')).toMatchObject({
      isToday: true,
      isSelectable: true,
    });
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('moves between months across a year end', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(monthTitle('2026-11')).toBe('November 2026');
  });
});

describe('weekday rule text (Spec §6.2)', () => {
  it('lists days Monday first and summarises the rule', () => {
    expect(describeWeekdays([0, 5, 1, 3])).toBe('Mon, Wed, Fri, Sun');
    expect(describeWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(
      describeRule({
        id: '11111111-1111-4111-8111-111111111111',
        mealType: 'LUNCH',
        mealName: 'Lunch',
        weekdays: [1, 3],
        slotId: '22222222-2222-4222-8222-222222222222',
        slotLabel: '1:00 PM - 1:30 PM',
        dietType: 'NON_VEG',
        version: 1,
        pausedReason: null,
      }),
    ).toBe('Lunch on Mon, Wed · 1:00 PM - 1:30 PM · Non-Veg');
  });
});
