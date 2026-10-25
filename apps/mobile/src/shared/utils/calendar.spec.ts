import { buildMonth, monthTitle, shiftMonth } from './calendar';

describe('buildMonth (Spec §6.1, §7 calendars)', () => {
  it('lays out a month Sunday-first and allows only dates within the bounds', () => {
    const weeks = buildMonth('2026-10', {
      firstDate: '2026-10-24',
      lastDate: '2026-11-07',
      today: '2026-10-24',
    });
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

  it('can allow past dates and keep later ones closed (My Bookings history)', () => {
    const cells = buildMonth('2026-10', {
      firstDate: '2025-10-25',
      lastDate: '2026-10-25',
      today: '2026-10-25',
    })
      .flat()
      .filter((cell) => cell !== null);
    expect(cells.find((cell) => cell.date === '2026-10-01')?.isSelectable).toBe(true);
    expect(cells.find((cell) => cell.date === '2026-10-26')?.isSelectable).toBe(false);
  });

  it('moves between months across a year end', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
    expect(monthTitle('2026-11')).toBe('November 2026');
  });
});
