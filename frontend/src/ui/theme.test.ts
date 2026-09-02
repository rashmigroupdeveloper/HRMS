/**
 * Theme resolution (docs/05 §1 rule 7 — dark mode is first-class).
 *
 * Resolution order is: explicit stored choice → OS preference. The subtle part
 * is that `system` must NOT persist anything, so a user who never chose keeps
 * following their OS instead of being frozen at whatever it was on first load.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './theme';

const STORAGE_KEY = 'hrms-theme';

function stubPrefersDark(dark: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query.includes('prefers-color-scheme: dark') ? dark : false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

describe('useTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('defaults to system and follows the OS preference', () => {
    stubPrefersDark(true);
    const { result } = renderHook(() => useTheme());

    expect(result.current.mode).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    // `system` must not persist — otherwise the user is frozen at first load.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('resolves to light when the OS prefers light', () => {
    stubPrefersDark(false);
    renderHook(() => useTheme());
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists an explicit choice and applies it over the OS preference', () => {
    stubPrefersDark(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode('dark');
    });

    expect(result.current.mode).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('restores a previously stored choice on mount', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    stubPrefersDark(false);

    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('returning to system clears the stored choice', () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    stubPrefersDark(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setMode('system');
    });

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets colorScheme so native form controls match the theme', () => {
    stubPrefersDark(true);
    renderHook(() => useTheme());
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('ignores a corrupted stored value and falls back to system', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-a-mode');
    stubPrefersDark(true);

    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('system');
  });
});
