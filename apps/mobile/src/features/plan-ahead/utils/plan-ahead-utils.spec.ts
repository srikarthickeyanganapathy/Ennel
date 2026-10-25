import { describeRule, describeWeekdays } from './weekdays';

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
