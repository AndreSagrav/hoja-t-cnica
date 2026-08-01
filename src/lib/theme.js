// ============================================================
// INNOVIO — Theme Manager (Dark Mode + Persistence)
// Auto-detects OS preference, allows manual toggle
// ============================================================

const THEME_KEY = 'innovio:theme';

/**
 * Get the current theme preference
 * @returns {'light'|'dark'|'auto'}
 */
export function getThemePreference() {
  return localStorage.getItem(THEME_KEY) || 'light';
}

/**
 * Set theme preference and apply it
 * @param {'light'|'dark'|'auto'} theme
 */
export function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

/**
 * Apply theme to document
 * @param {'light'|'dark'|'auto'} theme
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

/**
 * Toggle between light and dark (skipping auto)
 * @returns {'light'|'dark'} The new theme
 */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  
  // Haptic feedback on toggle
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
  
  return next;
}

/**
 * Initialize theme system
 * Call this once at app startup
 */
export function initTheme() {
  const pref = getThemePreference();
  applyTheme(pref);

  // Listen for OS theme changes (only matters in auto mode)
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (getThemePreference() === 'auto') {
      applyTheme('auto');
    }
  });
}

/**
 * Get the icon for theme toggle button
 * @returns {string} SVG icon string
 */
export function getThemeIcon() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'dark') {
    return '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>';
  }
  return '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';
}
