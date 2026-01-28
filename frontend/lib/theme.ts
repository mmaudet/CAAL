/**
 * CAAL Theme System
 *
 * Central source of truth for all theme colors and variants.
 * Easy to extend with new themes (Light, Grey Slate, etc.)
 */

export interface Theme {
  name: string;
  colors: {
    // Surface elevation system (darkest → lightest)
    surfaceDeep: string; // Deepest - welcome screen, modals backdrop
    surface0: string;
    surface1: string;
    surface2: string;
    surface3: string;
    surface4: string;

    // Primary brand colors
    primaryBg: string; // Fills (buttons, pills)
    primaryText: string; // Text and accents
    primary: string; // Unified primary (maps to primaryText)

    // Semantic colors
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;

    // Borders
    borderSubtle: string;
    borderDefault: string;
    borderEmphasis: string;
    borderTopHighlight: string;
  };
}

/**
 * Grey Slate Theme - Pure neutral grays with emerald green accents
 * Original CAAL theme - clean and professional without blue tint
 */
export const greySlateTheme: Theme = {
  name: 'Grey Slate',
  colors: {
    // Surface elevation - pure neutral grays (0 chroma)
    surfaceDeep: 'oklch(0.2178 0 0)', // Welcome screen - matches --background
    surface0: 'oklch(0.2178 0 0)', // Panels
    surface1: 'oklch(0.2178 0 0)', // Panels (same as surface0)
    surface2: 'oklch(0.31 0 0)', // Cards
    surface3: 'oklch(0.35 0 0)', // Hover states
    surface4: 'oklch(0.39 0 0)', // Highest elevation

    // Primary colors - muted emerald green (original CAAL)
    primaryBg: '#45997c',
    primaryText: '#45997c',
    primary: '#45997c',

    // Semantic colors - original neutral values
    background: 'oklch(0.2178 0 0)',
    foreground: 'oklch(0.985 0 0)',
    muted: 'oklch(0.269 0 0)',
    mutedForeground: 'oklch(0.708 0 0)', // Pure gray, no blue tint

    // Borders - same opacity-based system
    borderSubtle: 'oklch(1 0 0 / 4%)',
    borderDefault: 'oklch(1 0 0 / 8%)',
    borderEmphasis: 'oklch(1 0 0 / 12%)',
    borderTopHighlight: 'oklch(1 0 0 / 6%)',
  },
};

/**
 * Midnight Theme - Deep blue-gray surfaces with vibrant green accents
 * Current production theme with n8n-inspired glass morphism
 */
export const midnightTheme: Theme = {
  name: 'Midnight',
  colors: {
    // Surface elevation - blue-tinted slate
    surfaceDeep: 'oklch(0.15 0.0398 265.75)', // Welcome screen background
    surface0: 'oklch(0.2077 0.0398 265.75)', // Panels - Tailwind slate-900
    surface1: 'oklch(0.2795 0.0368 260.03)', // Panels & Modal- Tailwind slate-800
    surface2: 'oklch(0.32 0.035 260)', // Cards
    surface3: 'oklch(0.36 0.033 260)', // Hover states
    surface4: 'oklch(0.40 0.031 260)', // Highest elevation

    // Primary colors - vibrant emerald green
    primaryBg: '#3fb184',
    primaryText: '#3fb184',
    primary: '#3fb184',

    // Semantic colors
    background: 'oklch(0.15 0.0398 265.75)',
    foreground: 'oklch(0.985 0 0)',
    muted: 'oklch(0.269 0.02 260)',
    mutedForeground: 'oklch(0.7107 0.0351 256.79)', // Tailwind slate-400

    // Borders
    borderSubtle: 'oklch(1 0 0 / 4%)',
    borderDefault: 'oklch(1 0 0 / 8%)',
    borderEmphasis: 'oklch(1 0 0 / 12%)',
    borderTopHighlight: 'oklch(1 0 0 / 6%)',
  },
};

/**
 * Light Theme - Clean light surfaces inspired by code 3.html
 * Modern, airy design with subtle shadows instead of heavy borders
 */
export const lightTheme: Theme = {
  name: 'Light',
  colors: {
    // Surface elevation - light grays (inverted from dark themes)
    surfaceDeep: '#e2e8f0', // slate-200 - modal backdrops
    surface0: '#f8fafc', // slate-50 - main background
    surface1: '#ffffff', // white - panels
    surface2: '#ffffff', // white - cards, inputs
    surface3: '#f1f5f9', // slate-100 - hover states
    surface4: '#e2e8f0', // slate-200 - pressed/active states

    // Primary colors - same vibrant emerald
    primaryBg: '#3fb184',
    primaryText: '#3fb184',
    primary: '#3fb184',

    // Semantic colors
    background: '#f8fafc', // slate-50
    foreground: '#0f172a', // slate-900
    muted: '#f1f5f9', // slate-100
    mutedForeground: '#64748b', // slate-500

    // Borders - black-based opacity for light mode
    borderSubtle: 'oklch(0 0 0 / 6%)',
    borderDefault: 'oklch(0 0 0 / 10%)',
    borderEmphasis: 'oklch(0 0 0 / 15%)',
    borderTopHighlight: 'oklch(1 0 0 / 0%)', // Not needed for light theme
  },
};

/**
 * Available themes
 * Add new themes here as they're developed
 */
export const themes = {
  midnight: midnightTheme,
  greySlate: greySlateTheme,
  light: lightTheme,
} as const;

export type ThemeName = keyof typeof themes;

/**
 * Get theme by name with fallback to midnight
 */
export function getTheme(name?: ThemeName): Theme {
  return themes[name || 'midnight'] || midnightTheme;
}

/**
 * Generate CSS custom properties from theme
 */
export function generateThemeCSS(theme: Theme): string {
  const { colors } = theme;

  return `
    /* Surface elevation system */
    --surface-deep: ${colors.surfaceDeep};
    --surface-0: ${colors.surface0};
    --surface-1: ${colors.surface1};
    --surface-2: ${colors.surface2};
    --surface-3: ${colors.surface3};
    --surface-4: ${colors.surface4};

    /* Primary colors */
    --primary-bg: ${colors.primaryBg};
    --primary-text: ${colors.primaryText};
    --primary: ${colors.primary};

    /* Semantic colors */
    --background: ${colors.background};
    --foreground: ${colors.foreground};
    --muted: ${colors.muted};
    --muted-foreground: ${colors.mutedForeground};

    /* Borders */
    --border-subtle: ${colors.borderSubtle};
    --border-default: ${colors.borderDefault};
    --border-emphasis: ${colors.borderEmphasis};
    --border-top-highlight: ${colors.borderTopHighlight};
  `.trim();
}
