// Preset dashboard themes. Each one is a full set of overrides for the CSS
// custom properties declared on .pm-root in Dashboard.jsx (--ink, --paper,
// --paper-deep, --card, --muted, --border, --teal, --teal-deep) plus a
// sidebar gradient. "blue" intentionally matches the original hardcoded
// values exactly, so picking it (or the "default" theme when the super
// admin hasn't customized anything) looks pixel-identical to the app before
// theming existed.

export const THEME_LABELS = {
  default: "Default (System)",
  blue: "Blue (Water)",
  dark: "Dark",
  yellow: "Yellow",
  white: "White / Light",
};

export const THEME_ORDER = ["default", "blue", "dark", "yellow", "white"];

const BLUE = {
  ink: "#0B2233",
  paper: "#EEF6FC",
  paperDeep: "#DCF0FB",
  card: "#FFFFFF",
  muted: "#6B92AD",
  border: "#C5DFF0",
  teal: "#1A7FA8",
  tealDeep: "#0B4F6C",
  sidebarFrom: "#0B4F6C",
  sidebarTo: "#1A7FA8",
};

const PRESETS = {
  blue: BLUE,
  dark: {
    ink: "#E8F1FA",
    paper: "#111C25",
    paperDeep: "#182631",
    card: "#1D2C38",
    muted: "#8CA3B3",
    border: "#2E3F4C",
    teal: "#2CA8D8",
    tealDeep: "#1A7FA8",
    sidebarFrom: "#0B1620",
    sidebarTo: "#16283A",
  },
  yellow: {
    ink: "#3A2E00",
    paper: "#FFFBEA",
    paperDeep: "#FFF3C4",
    card: "#FFFFFF",
    muted: "#9C8A3D",
    border: "#F0DE9B",
    teal: "#C9A227",
    tealDeep: "#8A6D14",
    sidebarFrom: "#8A6D14",
    sidebarTo: "#C9A227",
  },
  white: {
    ink: "#1B2A35",
    paper: "#FFFFFF",
    paperDeep: "#F4F6F8",
    card: "#FFFFFF",
    muted: "#78838C",
    border: "#E2E6EA",
    teal: "#3B82F6",
    tealDeep: "#1E40AF",
    sidebarFrom: "#1E293B",
    sidebarTo: "#334155",
  },
};

// Turns a { ink, paper, paperDeep, card, muted, border, teal, tealDeep,
// sidebarFrom, sidebarTo } palette into the inline CSS custom properties
// object React expects, overriding the hardcoded values in the <style>
// block (inline style wins over the stylesheet on the same element).
function toCssVars(palette) {
  return {
    "--ink": palette.ink,
    "--paper": palette.paper,
    "--paper-deep": palette.paperDeep,
    "--card": palette.card,
    "--muted": palette.muted,
    "--border": palette.border,
    "--teal": palette.teal,
    "--teal-deep": palette.tealDeep,
    "--gold": palette.teal,
    "--sidebar-bg": `linear-gradient(180deg, ${palette.sidebarFrom} 0%, ${palette.sidebarTo} 100%)`,
  };
}

// myTheme: the user's personal choice ('default' | 'blue' | 'dark' | 'yellow' | 'white')
// systemTheme: { theme: {...partial palette...} | null, defaults: {...full BLUE palette...} } from GET /admin/system-theme
//
// Returns undefined when nothing should override the stylesheet defaults
// (myTheme === 'default' and no system customization exists yet), so the
// app renders pixel-identical to before theming was added.
export function getThemeVars(myTheme, systemTheme) {
  if (myTheme && myTheme !== "default" && PRESETS[myTheme]) {
    return toCssVars(PRESETS[myTheme]);
  }
  // "default" (or an unrecognized value) follows the system-wide palette,
  // if the super admin has set one.
  const custom = systemTheme?.theme;
  if (custom && Object.keys(custom).length > 0) {
    const defaults = systemTheme?.defaults || BLUE;
    return toCssVars({ ...defaults, ...custom });
  }
  return undefined;
}

export function getSystemPalette(systemTheme) {
  const defaults = systemTheme?.defaults || BLUE;
  return { ...defaults, ...(systemTheme?.theme || {}) };
}

export const DEFAULT_PALETTE = BLUE;
