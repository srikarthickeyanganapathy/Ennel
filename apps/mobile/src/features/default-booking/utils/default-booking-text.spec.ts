import { describeChange, describeSaveResult } from './default-booking-text';

describe('describeChange (Spec §8.3 summary of changes)', () => {
  it('names the meal and the setting with before and after values', () => {
    expect(
      describeChange({
        mealType: 'LUNCH',
        field: 'SLOT',
        from: '12:00 PM - 12:30 PM',
        to: '1:00 PM - 1:30 PM',
      }),
    ).toBe('Lunch slot: 12:00 PM - 12:30 PM → 1:00 PM - 1:30 PM');
    expect(describeChange({ mealType: 'BREAKFAST', field: 'ENABLED', from: 'ON', to: 'OFF' })).toBe(
      'Breakfast automatic booking: ON → OFF',
    );
    expect(
      describeChange({ mealType: null, field: 'DEFAULT_BOOKING', from: 'ON', to: 'OFF' }),
    ).toBe('Default Booking turned OFF');
  });

  it('adds how many upcoming bookings moved, and says when nothing changed', () => {
    expect(describeSaveResult([], 0)).toBe('Nothing changed.');
    expect(
      describeSaveResult(
        [{ mealType: 'DINNER', field: 'MEAL_TYPE', from: 'Veg', to: 'Non-Veg' }],
        1,
      ),
    ).toBe('Dinner meal type: Veg → Non-Veg\n1 upcoming booking was updated to match.');
  });
});
