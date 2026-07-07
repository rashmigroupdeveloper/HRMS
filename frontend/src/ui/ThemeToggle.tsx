import { Moon, Sun } from 'lucide-react';
import { IconButton } from './IconButton';
import { useTheme } from './theme';

/**
 * ThemeToggle — masthead control (docs/05 §3). Flips light↔dark; the icon
 * reflects the action, not the current state. Keyboard/focus handled by
 * IconButton. No animation: seen many times a day (frequency test, §2.1).
 */
export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <IconButton
      label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      icon={isDark ? <Sun /> : <Moon />}
      onClick={toggle}
    />
  );
}
