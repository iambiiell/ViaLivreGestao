export interface ThemeColorPalette {
  id: string;
  name: string;
  primary: string;
  dark: string;
  bgClass: string;
  c50: string;
  c100: string;
  c200: string;
  c300: string;
  c400: string;
  c500: string;
  c600: string;
  c700: string;
  c800: string;
  c900: string;
}

export const PRESET_THEME_COLORS: ThemeColorPalette[] = [
  {
    id: 'yellow',
    name: 'Amarelo ViaLivre (Padrão)',
    primary: '#facc15',
    dark: '#eab308',
    bgClass: 'bg-[#facc15]',
    c50: '#fefce8',
    c100: '#fef9c3',
    c200: '#fef08a',
    c300: '#fde047',
    c400: '#facc15',
    c500: '#eab308',
    c600: '#ca8a04',
    c700: '#a16207',
    c800: '#854d0e',
    c900: '#713f12'
  },
  {
    id: 'blue',
    name: 'Azul Corporativo',
    primary: '#3b82f6',
    dark: '#2563eb',
    bgClass: 'bg-[#3b82f6]',
    c50: '#eff6ff',
    c100: '#dbeafe',
    c200: '#bfdbfe',
    c300: '#93c5fd',
    c400: '#3b82f6',
    c500: '#2563eb',
    c600: '#1d4ed8',
    c700: '#1e40af',
    c800: '#1e3a8a',
    c900: '#172554'
  },
  {
    id: 'indigo',
    name: 'Índigo Moderno',
    primary: '#6366f1',
    dark: '#4f46e5',
    bgClass: 'bg-[#6366f1]',
    c50: '#eef2ff',
    c100: '#e0e7ff',
    c200: '#c7d2fe',
    c300: '#a5b4fc',
    c400: '#6366f1',
    c500: '#4f46e5',
    c600: '#4338ca',
    c700: '#3730a3',
    c800: '#312e81',
    c900: '#1e1b4b'
  },
  {
    id: 'emerald',
    name: 'Verde Esmeralda',
    primary: '#10b981',
    dark: '#059669',
    bgClass: 'bg-[#10b981]',
    c50: '#ecfdf5',
    c100: '#d1fae5',
    c200: '#a7f3d0',
    c300: '#6ee7b7',
    c400: '#10b981',
    c500: '#059669',
    c600: '#047857',
    c700: '#065f46',
    c800: '#064e3b',
    c900: '#022c22'
  },
  {
    id: 'rose',
    name: 'Rosa Elegante',
    primary: '#ec4899',
    dark: '#db2777',
    bgClass: 'bg-[#ec4899]',
    c50: '#fff1f2',
    c100: '#ffe4e6',
    c200: '#fecdd3',
    c300: '#fda4af',
    c400: '#ec4899',
    c500: '#db2777',
    c600: '#be185d',
    c700: '#9d174d',
    c800: '#831843',
    c900: '#500724'
  },
  {
    id: 'purple',
    name: 'Roxo Imperial',
    primary: '#a855f7',
    dark: '#9333ea',
    bgClass: 'bg-[#a855f7]',
    c50: '#faf5ff',
    c100: '#f3e8ff',
    c200: '#e9d5ff',
    c300: '#d8b4fe',
    c400: '#a855f7',
    c500: '#9333ea',
    c600: '#7e22ce',
    c700: '#6b21a8',
    c800: '#581c87',
    c900: '#3b0764'
  },
  {
    id: 'orange',
    name: 'Laranja Vibrante',
    primary: '#f97316',
    dark: '#ea580c',
    bgClass: 'bg-[#f97316]',
    c50: '#fff7ed',
    c100: '#ffedd5',
    c200: '#fed7aa',
    c300: '#fdba74',
    c400: '#f97316',
    c500: '#ea580c',
    c600: '#c2410c',
    c700: '#9a3412',
    c800: '#7c2d12',
    c900: '#431407'
  },
  {
    id: 'cyan',
    name: 'Ciano Tecnológico',
    primary: '#06b6d4',
    dark: '#0891b2',
    bgClass: 'bg-[#06b6d4]',
    c50: '#ecfeff',
    c100: '#cffafe',
    c200: '#a5f3fc',
    c300: '#67e8f9',
    c400: '#06b6d4',
    c500: '#0891b2',
    c600: '#0e7490',
    c700: '#155e75',
    c800: '#164e63',
    c900: '#083344'
  },
  {
    id: 'red',
    name: 'Vermelho Escarlate',
    primary: '#ef4444',
    dark: '#dc2626',
    bgClass: 'bg-[#ef4444]',
    c50: '#fef2f2',
    c100: '#fee2e2',
    c200: '#fecaca',
    c300: '#fca5a5',
    c400: '#ef4444',
    c500: '#dc2626',
    c600: '#b91c1c',
    c700: '#991b1b',
    c800: '#7f1d1d',
    c900: '#450a0a'
  }
];

export interface ResolvedThemeColors {
  primary: string;
  dark: string;
  isCustom: boolean;
  hex: string;
  c50: string;
  c100: string;
  c200: string;
  c300: string;
  c400: string;
  c500: string;
  c600: string;
  c700: string;
  c800: string;
  c900: string;
}

/**
 * Ajusta o brilho de uma cor hexadecimal (ex: clarear ou escurecer)
 */
export function adjustColorBrightness(hex: string, percent: number): string {
  if (!hex) return '#facc15';
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return hex;

  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Valida se é um código hexadecimal válido (#RGB ou #RRGGBB)
 */
export function isValidHexColor(hex: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

/**
 * Resolve todos os valores de paleta (50 a 900) para a cor selecionada
 */
export function resolveThemeColors(colorValue: string | undefined): ResolvedThemeColors {
  const current = (colorValue || 'yellow').trim();

  // 1. Verifica se é um preset conhecido
  const preset = PRESET_THEME_COLORS.find(c => c.id === current.toLowerCase() || c.primary.toLowerCase() === current.toLowerCase());
  if (preset) {
    return {
      primary: preset.primary,
      dark: preset.dark,
      isCustom: false,
      hex: preset.primary,
      c50: preset.c50,
      c100: preset.c100,
      c200: preset.c200,
      c300: preset.c300,
      c400: preset.c400,
      c500: preset.c500,
      c600: preset.c600,
      c700: preset.c700,
      c800: preset.c800,
      c900: preset.c900
    };
  }

  // 2. Verifica se é um código hex customizado
  if (isValidHexColor(current)) {
    return {
      primary: current,
      dark: adjustColorBrightness(current, -18),
      isCustom: true,
      hex: current,
      c50: adjustColorBrightness(current, 85),
      c100: adjustColorBrightness(current, 70),
      c200: adjustColorBrightness(current, 50),
      c300: adjustColorBrightness(current, 25),
      c400: current,
      c500: adjustColorBrightness(current, -18),
      c600: adjustColorBrightness(current, -32),
      c700: adjustColorBrightness(current, -46),
      c800: adjustColorBrightness(current, -60),
      c900: adjustColorBrightness(current, -74)
    };
  }

  // Fallback padrão Amarelo Nicolau
  const yellowPreset = PRESET_THEME_COLORS[0];
  return {
    primary: yellowPreset.primary,
    dark: yellowPreset.dark,
    isCustom: false,
    hex: yellowPreset.primary,
    c50: yellowPreset.c50,
    c100: yellowPreset.c100,
    c200: yellowPreset.c200,
    c300: yellowPreset.c300,
    c400: yellowPreset.c400,
    c500: yellowPreset.c500,
    c600: yellowPreset.c600,
    c700: yellowPreset.c700,
    c800: yellowPreset.c800,
    c900: yellowPreset.c900
  };
}

/**
 * Aplica todas as variáveis CSS no document.documentElement de forma global e imediata
 */
export function applyThemeVariables(colorValue: string | undefined): ResolvedThemeColors {
  const colors = resolveThemeColors(colorValue);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', colors.primary);
    root.style.setProperty('--primary-color-dark', colors.dark);
    root.style.setProperty('--primary-color-50', colors.c50);
    root.style.setProperty('--primary-color-100', colors.c100);
    root.style.setProperty('--primary-color-200', colors.c200);
    root.style.setProperty('--primary-color-300', colors.c300);
    root.style.setProperty('--primary-color-400', colors.c400);
    root.style.setProperty('--primary-color-500', colors.c500);
    root.style.setProperty('--primary-color-600', colors.c600);
    root.style.setProperty('--primary-color-700', colors.c700);
    root.style.setProperty('--primary-color-800', colors.c800);
    root.style.setProperty('--primary-color-900', colors.c900);
  }
  return colors;
}

/**
 * Alterna entre Modo Claro ('light') e Modo Escuro ('dark')
 */
export function applyThemeMode(mode: 'light' | 'dark'): void {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('fluxo_theme', mode);
  }
}
