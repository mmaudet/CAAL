'use client';

import { useEffect } from 'react';
import { type ThemeName, getTheme } from '@/lib/theme';

const THEME_STORAGE_KEY = 'caal-theme';

/**
 * Apply theme CSS variables to document root
 */
function applyThemeColors(themeName: ThemeName) {
  const theme = getTheme(themeName);
  const { colors } = theme;
  const root = document.documentElement;

  root.style.setProperty('--surface-deep', colors.surfaceDeep);
  root.style.setProperty('--surface-0', colors.surface0);
  root.style.setProperty('--surface-1', colors.surface1);
  root.style.setProperty('--surface-2', colors.surface2);
  root.style.setProperty('--surface-3', colors.surface3);
  root.style.setProperty('--surface-4', colors.surface4);
  root.style.setProperty('--primary-bg', colors.primaryBg);
  root.style.setProperty('--primary-text', colors.primaryText);
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--border-subtle', colors.borderSubtle);
  root.style.setProperty('--border-default', colors.borderDefault);
  root.style.setProperty('--border-emphasis', colors.borderEmphasis);
  root.style.setProperty('--border-top-highlight', colors.borderTopHighlight);
}

/**
 * Hook to initialize and apply the CAAL theme on app startup.
 * Uses localStorage for instant theme application, syncs with server.
 */
export function useCaalTheme() {
  useEffect(() => {
    // Step 1: Apply cached theme from localStorage immediately (sync, no flash)
    const cachedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
    if (cachedTheme) {
      applyThemeColors(cachedTheme);
    }

    // Step 2: Fetch from server to ensure we're in sync
    const syncWithServer = async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;

        const data = await res.json();
        const serverTheme = (data.settings?.theme as ThemeName) || 'midnight';

        // Update localStorage and apply if different from cached
        if (serverTheme !== cachedTheme) {
          localStorage.setItem(THEME_STORAGE_KEY, serverTheme);
          applyThemeColors(serverTheme);
        }
      } catch (error) {
        console.error('[useCaalTheme] Failed to sync theme:', error);
      }
    };

    syncWithServer();
  }, []);
}

/**
 * Save theme to localStorage (call this when user changes theme)
 */
export function saveThemeToCache(themeName: ThemeName) {
  localStorage.setItem(THEME_STORAGE_KEY, themeName);
}
