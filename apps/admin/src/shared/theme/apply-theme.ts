import { THEME_COLORS, THEME_RADII } from '@ennel/shared';

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Writes the shared design tokens to CSS variables consumed by index.css. */
export function applyTheme(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(THEME_COLORS)) {
    root.style.setProperty(`--ennel-${toKebabCase(name)}`, value);
  }
  for (const [name, value] of Object.entries(THEME_RADII)) {
    root.style.setProperty(`--ennel-radius-${name}`, value);
  }
}
