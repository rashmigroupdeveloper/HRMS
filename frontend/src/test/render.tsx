/**
 * Render helpers — every kit component is checked in BOTH themes, because the
 * token values differ and docs/05 §7 sets the bar "in both themes", not "in
 * light".
 */
import type { ReactElement } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export type Theme = 'light' | 'dark';
export const THEMES: Theme[] = ['light', 'dark'];

/** Render inside a themed root, mirroring how AppShell stamps the theme. */
export function renderThemed(ui: ReactElement, theme: Theme = 'light'): RenderResult {
  document.documentElement.dataset['theme'] = theme;
  return render(ui);
}

/** Render with a router, for anything containing a <Link>. */
export function renderRouted(ui: ReactElement, theme: Theme = 'light'): RenderResult {
  document.documentElement.dataset['theme'] = theme;
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}
