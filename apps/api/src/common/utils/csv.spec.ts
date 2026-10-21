import { describe, expect, it } from 'vitest';
import { neutralizeCell, toSafeCsv } from './csv';

describe('formula-safe CSV (Admin §P export)', () => {
  it('prefixes cells a spreadsheet would run as a formula', () => {
    expect(neutralizeCell('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(neutralizeCell('+1')).toBe("'+1");
    expect(neutralizeCell('-2')).toBe("'-2");
    expect(neutralizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(neutralizeCell('Room change per warden')).toBe('Room change per warden');
    expect(neutralizeCell('')).toBe('');
  });

  it('writes a header and neutralized rows', () => {
    expect(toSafeCsv([{ action: 'student.update', reason: '=cmd' }])).toBe(
      "action,reason\nstudent.update,'=cmd\n",
    );
  });
});
