import { describe, expect, it } from 'vitest';
import { applyTheme } from './apply-theme';

describe('applyTheme', () => {
  it('writes the shared palette to CSS variables', () => {
    const root = document.createElement('div');
    applyTheme(root);
    expect(root.style.getPropertyValue('--ennel-primary')).toBe('#0B5D46');
    expect(root.style.getPropertyValue('--ennel-mint')).toBe('#E7F4EC');
    expect(root.style.getPropertyValue('--ennel-radius-md')).toBe('10px');
  });
});
