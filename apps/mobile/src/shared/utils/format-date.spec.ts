import { describeBusinessDate, formatBusinessDate } from './format-date';

describe('business date formatting (Spec §4.2, §17)', () => {
  it('formats a date as weekday, day and month', () => {
    expect(formatBusinessDate('2026-10-22')).toBe('Thu, 22 Oct');
    expect(formatBusinessDate('2026-01-04')).toBe('Sun, 4 Jan');
  });

  it('says Today or Tomorrow so a future date is never mistaken for today', () => {
    expect(describeBusinessDate('2026-10-21', '2026-10-21', '2026-10-22')).toBe(
      'Today, Wed, 21 Oct',
    );
    expect(describeBusinessDate('2026-10-22', '2026-10-21', '2026-10-22')).toBe(
      'Tomorrow, Thu, 22 Oct',
    );
    expect(describeBusinessDate('2026-10-25', '2026-10-21', '2026-10-22')).toBe('Sun, 25 Oct');
  });
});
